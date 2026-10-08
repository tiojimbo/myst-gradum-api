import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { AiEngine } from '@prisma/client';
import {
  AiCompletion,
  AiMessage,
  AiOutputContract,
  JsonObject,
  JsonValue,
  PromptReference,
  UpdateAiRun,
} from './ai.params';
import { AiRunsRepository } from './ai-runs.repository';
import { OpenRouterClient, ProviderError } from './openrouter.client';
import { PromptRegistry } from './prompt.registry';
import { buildUntrustedBlock } from './prompts/untrusted-block';
import {
  AiDisabledException,
  AiInvalidOutputException,
  AiUnavailableException,
} from './errors/ai.exceptions';
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  constructor(
    private readonly config: ConfigService,
    private readonly repository: AiRunsRepository,
    private readonly client: OpenRouterClient,
    private readonly registry: PromptRegistry,
  ) {}
  private getSchemaFields(schema: JsonObject): Set<string> {
    const fields = new Set<string>();
    const visit = (value: JsonValue): void => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (
        value.properties &&
        typeof value.properties === 'object' &&
        !Array.isArray(value.properties)
      )
        Object.keys(value.properties).forEach((key) => fields.add(key));
      Object.values(value).forEach(visit);
    };
    visit(schema);
    return fields;
  }
  async run<TOutput>(
    engine: AiEngine,
    reference: PromptReference,
    input: JsonValue,
    contract: AiOutputContract<TOutput>,
  ): Promise<TOutput> {
    if (!this.config.get<boolean>('AI_ENABLED', false)) throw new AiDisabledException();
    const prompt = this.registry.get(reference.name, reference.version);
    const modelKey = {
      GOAL: 'AI_MODEL_GOAL',
      COMPETENCY: 'AI_MODEL_COMPETENCY',
      DIAGNOSTIC: 'AI_MODEL_DIAGNOSTIC',
      ASSESSMENT: 'AI_MODEL_GRADING',
    };
    const overrideKey = modelKey[engine as keyof typeof modelKey];
    const model =
      (overrideKey ? this.config.get<string>(overrideKey) : undefined) ??
      this.config.getOrThrow<string>('AI_MODEL_DEFAULT');
    const started = Date.now();
    const expiresAt = started + this.config.get<number>('AI_TIMEOUT_MS', 60000);
    const controller = new AbortController();
    let runId: string | undefined;
    let expired = false;
    let unobservedAttempt = false;
    let lastWrite: Promise<unknown> = Promise.resolve();
    let rejectDeadline: (error: AiUnavailableException) => void = () => undefined;
    const deadline = new Promise<never>((_, reject) => {
      rejectDeadline = reject;
    });
    const completions: AiCompletion[] = [];
    const metrics = () => {
      const sum = (key: 'tokensIn' | 'tokensOut' | 'costUsd') =>
        completions.length > 0 &&
        !unobservedAttempt &&
        completions.every((result) => result[key] !== undefined)
          ? completions.reduce((total, result) => total + result[key]!, 0)
          : null;
      return {
        tokensIn: sum('tokensIn'),
        tokensOut: sum('tokensOut'),
        costUsd: sum('costUsd'),
        model: completions.at(-1)?.model ?? model,
        latencyMs: Date.now() - started,
      };
    };
    const expire = () => {
      if (expired) return;
      expired = true;
      controller.abort();
      rejectDeadline(new AiUnavailableException());
      void lastWrite
        .catch(() => undefined)
        .then(async () => {
          if (!runId) return;
          await this.repository.update(runId, {
            ...metrics(),
            status: 'FAILED',
            error: 'PROVIDER_TIMEOUT',
            output: null,
            validationErrors: null,
          });
        })
        .catch(() => {
          this.logger.warn('AI_TIMEOUT_AUDIT_FAILED');
        });
    };
    const assertActive = () => {
      if (expired || Date.now() >= expiresAt) {
        expire();
        throw new AiUnavailableException();
      }
    };
    const persist = async (data: UpdateAiRun) => {
      assertActive();
      lastWrite = this.repository.update(runId!, data);
      await lastWrite;
      assertActive();
    };
    const timeout = setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    const execute = async (): Promise<TOutput> => {
      assertActive();
      const creation = this.repository
        .create({
          engine,
          promptName: prompt.name,
          promptVersion: prompt.version,
          model,
          input,
          status: 'PENDING',
        })
        .then((run) => {
          runId = run.id;
          return run;
        });
      lastWrite = creation;
      await creation;
      assertActive();
      await persist({ status: 'RUNNING' });
      const messages: AiMessage[] = [
        {
          role: 'system',
          content: `${prompt.system}\nContrato de saída JSON: ${JSON.stringify(contract.jsonSchema)}`,
        },
        { role: 'user', content: buildUntrustedBlock(input) },
      ];
      const schemaFields = this.getSchemaFields(contract.jsonSchema);
      for (let attempt = 0; attempt < 2; attempt++) {
        assertActive();
        let result: AiCompletion;
        try {
          unobservedAttempt = true;
          result = await Promise.race([
            this.client.complete({
              model,
              messages,
              schema: contract.jsonSchema,
              schemaName: `${prompt.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_v${prompt.version}`,
              signal: controller.signal,
            }),
            deadline,
          ]);
        } catch (error) {
          assertActive();
          const category = error instanceof ProviderError ? error.category : 'PROVIDER_UNAVAILABLE';
          await persist({
            ...metrics(),
            tokensIn: null,
            tokensOut: null,
            costUsd: null,
            status: 'FAILED',
            error: category,
          });
          this.logger.warn(
            `promptName=${prompt.name} promptVersion=${prompt.version} status=FAILED`,
          );
          throw new AiUnavailableException();
        }
        assertActive();
        completions.push(result);
        unobservedAttempt = false;
        let decoded: unknown;
        let codes: string[];
        try {
          decoded = JSON.parse(result.content ?? '');
          codes = [];
        } catch {
          codes = ['invalid_json'];
        }
        const parsed = codes.length ? undefined : contract.schema.safeParse(decoded);
        if (parsed?.success) {
          const output: JsonValue = JSON.parse(JSON.stringify(parsed.data)) as JsonValue;
          await persist({ ...metrics(), status: 'DONE', output });
          assertActive();
          this.logger.log(
            `promptName=${prompt.name} promptVersion=${prompt.version} inputSize=${messages[1].content.length} outputSize=${result.content?.length ?? 0} status=DONE`,
          );
          return parsed.data;
        }
        if (parsed && !parsed.success) codes = parsed.error.issues.map((issue) => issue.code);
        const validationErrors =
          parsed && !parsed.success
            ? parsed.error.issues.map((issue) => ({
                code: issue.code,
                path: issue.path.map((part) =>
                  typeof part === 'number' || schemaFields.has(part) ? part : '[field]',
                ),
                message: 'Campo incompatível com o contrato',
              }))
            : codes.map((code) => ({ code, path: [], message: 'Conteúdo deve ser JSON válido' }));
        if (attempt === 1) {
          await persist({
            ...metrics(),
            status: 'INVALID',
            validationErrors,
          });
          throw new AiInvalidOutputException();
        }
        messages.push({
          role: 'user',
          content: `A resposta anterior não satisfez o contrato. Retorne somente JSON válido corrigindo estes problemas: ${JSON.stringify(validationErrors)}.`,
        });
      }
      throw new AiInvalidOutputException();
    };
    try {
      const output = await Promise.race([execute(), deadline]);
      assertActive();
      return output;
    } finally {
      clearTimeout(timeout);
    }
  }
}
