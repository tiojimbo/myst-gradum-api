import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { z } from 'zod';
import { AiCompletion, CompletionParams } from './ai.params';
export const OPENROUTER_FETCH = Symbol('OPENROUTER_FETCH');
export class ProviderError extends Error {
  constructor(
    readonly category:
      | 'PROVIDER_HTTP'
      | 'PROVIDER_ERROR'
      | 'PROVIDER_RESPONSE'
      | 'PROVIDER_UNAVAILABLE'
      | 'PROVIDER_TIMEOUT',
  ) {
    super(category);
  }
}
const METRIC = z
  .number()
  .finite()
  .nonnegative()
  .nullish()
  .transform((value) => value ?? undefined);
const TOKEN_METRIC = z
  .number()
  .int()
  .nonnegative()
  .nullish()
  .transform((value) => value ?? undefined);
const COMPLETION_RESPONSE = z.object({
  model: z.string().min(1).optional(),
  choices: z
    .array(
      z.object({ message: z.object({ content: z.string().nullable().optional() }).optional() }),
    )
    .optional(),
  usage: z
    .object({ prompt_tokens: TOKEN_METRIC, completion_tokens: TOKEN_METRIC, cost: METRIC })
    .nullish(),
  error: z.unknown().optional(),
});
@Injectable()
export class OpenRouterClient {
  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(OPENROUTER_FETCH)
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}
  async complete(params: CompletionParams): Promise<AiCompletion> {
    const supportedModels = this.config
      .get<string>('OPENROUTER_JSON_SCHEMA_MODELS', '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
    const structured = supportedModels.includes(params.model);
    const referer = this.config.get<string>('OPENROUTER_HTTP_REFERER');
    const title = this.config.get<string>('OPENROUTER_TITLE');
    const base = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/$/, '');
    try {
      const response = await this.fetcher(`${base}/chat/completions`, {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.getOrThrow<string>('OPENROUTER_API_KEY')}`,
          ...(referer ? { 'HTTP-Referer': referer } : {}),
          ...(title ? { 'X-Title': title } : {}),
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          max_tokens: this.config.get<number>('AI_MAX_TOKENS', 4000),
          stream: false,
          ...(structured
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: { name: params.schemaName, strict: true, schema: params.schema },
                },
                provider: { require_parameters: true },
              }
            : {}),
        }),
      });
      if (!response.ok) throw new ProviderError('PROVIDER_HTTP');
      let decoded: unknown;
      try {
        decoded = JSON.parse(await response.text());
      } catch (error) {
        if (params.signal.aborted) throw error;
        throw new ProviderError('PROVIDER_RESPONSE');
      }
      const parsed = COMPLETION_RESPONSE.safeParse(decoded);
      if (!parsed.success) throw new ProviderError('PROVIDER_RESPONSE');
      if (parsed.data.error !== undefined) throw new ProviderError('PROVIDER_ERROR');
      return {
        content: parsed.data.choices?.[0]?.message?.content ?? undefined,
        model: parsed.data.model ?? params.model,
        tokensIn: parsed.data.usage?.prompt_tokens,
        tokensOut: parsed.data.usage?.completion_tokens,
        costUsd: parsed.data.usage?.cost,
      };
    } catch (error) {
      if (params.signal.aborted) throw new ProviderError('PROVIDER_TIMEOUT');
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('PROVIDER_UNAVAILABLE');
    }
  }
}
