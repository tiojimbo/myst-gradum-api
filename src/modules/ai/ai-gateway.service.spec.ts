import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiGatewayService } from './ai-gateway.service';
import { AiRunsRepository } from './ai-runs.repository';
import { OpenRouterClient } from './openrouter.client';
import { PromptRegistry } from './prompt.registry';

describe('AiGatewayService', () => {
  const schema = {
    schema: z.object({ answer: z.string() }).strict(),
    jsonSchema: {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
      additionalProperties: false,
    },
  };
  let config: ConfigService;
  let environment: Record<string, unknown>;
  let repository: { create: jest.Mock; update: jest.Mock };
  let client: { complete: jest.Mock };
  let service: AiGatewayService;
  const result = (content = '{"answer":"ok"}') => ({
    content,
    model: 'effective/model',
    tokensIn: 5,
    tokensOut: 7,
    costUsd: 0.002,
  });
  beforeEach(() => {
    environment = {
      AI_ENABLED: true,
      AI_MODEL_DEFAULT: 'default/model',
      AI_MODEL_GOAL: 'goal/model',
      AI_TIMEOUT_MS: 1000,
    };
    config = new ConfigService({ _PROCESS_ENV_VALIDATED: environment });
    repository = {
      create: jest.fn().mockResolvedValue({ id: 'run-id' }),
      update: jest.fn().mockResolvedValue({ id: 'run-id' }),
    };
    client = { complete: jest.fn().mockResolvedValue(result()) };
    service = new AiGatewayService(
      config,
      repository as unknown as AiRunsRepository,
      client as unknown as OpenRouterClient,
      new PromptRegistry(),
    );
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  const run = () =>
    service.run('GOAL', { name: 'base.system', version: 1 }, { goal: 'Meu objetivo' }, schema);
  it('não persiste nem chama provedor com IA desligada', async () => {
    environment.AI_ENABLED = false;
    await expect(run()).rejects.toMatchObject({ response: { error: 'AI_DISABLED' } });
    expect(repository.create).not.toHaveBeenCalled();
    expect(client.complete).not.toHaveBeenCalled();
  });
  it('cria auditoria antes do provedor e devolve somente saída validada', async () => {
    await expect(run()).resolves.toEqual({ answer: 'ok' });
    expect(repository.create.mock.invocationCallOrder[0]).toBeLessThan(
      client.complete.mock.invocationCallOrder[0],
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: 'GOAL',
        status: 'PENDING',
        model: 'goal/model',
        promptName: 'base.system',
        promptVersion: 1,
      }),
    );
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({
        status: 'DONE',
        model: 'effective/model',
        output: { answer: 'ok' },
        tokensIn: 5,
        tokensOut: 7,
        costUsd: 0.002,
      }),
    );
  });
  it('corrige JSON inválido uma vez e soma o uso das duas tentativas', async () => {
    client.complete.mockResolvedValueOnce(result('não JSON')).mockResolvedValueOnce(result());
    await expect(run()).resolves.toEqual({ answer: 'ok' });
    expect(client.complete).toHaveBeenCalledTimes(2);
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({ status: 'DONE', tokensIn: 10, tokensOut: 14, costUsd: 0.004 }),
    );
  });
  it('rejeita duas saídas inválidas sem persistir conteúdo como saída validada', async () => {
    client.complete.mockResolvedValue(result('{"answer":42,"private":"texto privado"}'));
    await expect(run()).rejects.toMatchObject({ response: { error: 'AI_INVALID_OUTPUT' } });
    expect(client.complete).toHaveBeenCalledTimes(2);
    const last = repository.update.mock.calls.at(-1)![1];
    expect(last).toMatchObject({ status: 'INVALID', tokensIn: 10 });
    expect(last).not.toHaveProperty('output');
    expect(JSON.stringify(last.validationErrors)).not.toContain('texto privado');
    expect(JSON.stringify(client.complete.mock.calls[1])).not.toContain('texto privado');
  });
  it('erro de rede não gera retry nem expõe mensagem privada', async () => {
    client.complete.mockRejectedValue(new Error('chave e nota privadas'));
    await expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    expect(client.complete).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({ status: 'FAILED', error: 'PROVIDER_UNAVAILABLE' }),
    );
    expect(JSON.stringify(repository.update.mock.calls)).not.toContain('chave e nota privadas');
  });
  it('não chama provedor se auditoria inicial falha', async () => {
    repository.create.mockRejectedValue(new Error('banco indisponível'));
    await expect(run()).rejects.toThrow();
    expect(client.complete).not.toHaveBeenCalled();
  });
  it('não devolve sucesso se conclusão da auditoria falha', async () => {
    repository.update.mockImplementation((_id: string, data: { status: string }) =>
      data.status === 'DONE' ? Promise.reject(new Error('banco')) : Promise.resolve(),
    );
    await expect(run()).rejects.toThrow('banco');
  });
  it('rejeita prompt não registrado antes de criar auditoria', async () => {
    await expect(
      service.run('GOAL', { name: 'foreign.prompt', version: 1 }, {}, schema),
    ).rejects.toThrow('PROMPT_NOT_REGISTERED');
    expect(repository.create).not.toHaveBeenCalled();
    expect(client.complete).not.toHaveBeenCalled();
  });
  it('não registra entrada, saída nem segredo em logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    await service.run(
      'GOAL',
      { name: 'base.system', version: 1 },
      { goal: 'nota-privada-chave' },
      schema,
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('nota-privada-chave');
    expect(JSON.stringify(log.mock.calls)).not.toContain('"answer"');
    expect(JSON.stringify(log.mock.calls)).toContain('promptName=base.system');
  });
  it('mantém total desconhecido quando uma tentativa não retorna métricas', async () => {
    client.complete
      .mockResolvedValueOnce(result('inválido'))
      .mockResolvedValueOnce({ content: '{"answer":"ok"}', model: 'effective/model' });
    await expect(run()).resolves.toEqual({ answer: 'ok' });
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({ tokensIn: null, tokensOut: null, costUsd: null }),
    );
  });
  it('corrige conteúdo ausente como saída inválida', async () => {
    client.complete
      .mockResolvedValueOnce({ ...result(), content: undefined })
      .mockResolvedValueOnce(result());
    await expect(run()).resolves.toEqual({ answer: 'ok' });
    expect(client.complete).toHaveBeenCalledTimes(2);
  });
  it('indica caminho de campo confiável sem ecoar conteúdo inválido', async () => {
    client.complete.mockResolvedValueOnce(result('{"answer":42}')).mockResolvedValueOnce(result());
    await run();
    const correction = client.complete.mock.calls[1][0].messages.at(-1).content;
    expect(correction).toContain('"path":["answer"]');
  });
  it('orçamento é compartilhado pelas duas tentativas', async () => {
    jest.useFakeTimers();
    client.complete
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(result('inválido')), 700)),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(result()), 700)),
      );
    const pending = expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    await jest.advanceTimersByTimeAsync(1001);
    await pending;
    expect(client.complete).toHaveBeenCalledTimes(2);
  });
  it('não apresenta subtotal como total se correção falha por rede', async () => {
    client.complete
      .mockResolvedValueOnce(result('inválido'))
      .mockRejectedValueOnce(new Error('private'));
    await expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({ status: 'FAILED', tokensIn: null, tokensOut: null, costUsd: null }),
    );
  });
  it('respeita orçamento único e aborta chamada que não termina', async () => {
    jest.useFakeTimers();
    client.complete.mockImplementation(() => new Promise(() => undefined));
    const promise = expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    await jest.advanceTimersByTimeAsync(1001);
    await promise;
    expect(repository.update).toHaveBeenLastCalledWith(
      'run-id',
      expect.objectContaining({ status: 'FAILED', error: 'PROVIDER_TIMEOUT' }),
    );
    expect(client.complete.mock.calls[0][0].signal.aborted).toBe(true);
  });
  it.each(['CREATE', 'RUNNING', 'DONE', 'FAILED'] as const)(
    'inclui gravação %s no prazo e não devolve sucesso tardio',
    async (stage) => {
      jest.useFakeTimers();
      environment.AI_TIMEOUT_MS = 10;
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      let writesInFlight = 0;
      let collided = false;
      if (stage === 'CREATE') {
        repository.create.mockImplementation(() => {
          writesInFlight++;
          return new Promise((resolve) =>
            setTimeout(() => {
              writesInFlight--;
              resolve({ id: 'run-id' });
            }, 50),
          );
        });
      }
      repository.update.mockImplementation((_id: string, data: { status: string }) => {
        if (writesInFlight > 0) collided = true;
        if (data.status !== stage) return Promise.resolve();
        writesInFlight++;
        return new Promise((resolve) =>
          setTimeout(() => {
            writesInFlight--;
            resolve(undefined);
          }, 50),
        );
      });
      if (stage === 'FAILED') client.complete.mockRejectedValue(new Error('indisponível'));
      let outcome = 'pending';
      const pending = run().then(
        () => {
          outcome = 'success';
        },
        (error: unknown) => {
          expect(error).toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
          outcome = 'failed';
        },
      );
      try {
        await jest.advanceTimersByTimeAsync(11);
        expect(outcome).toBe('failed');
        if (stage === 'CREATE' || stage === 'RUNNING')
          expect(client.complete).not.toHaveBeenCalled();
        expect(log.mock.calls.some((call) => String(call[0]).includes('status=DONE'))).toBe(false);
      } finally {
        await jest.advanceTimersByTimeAsync(120);
        await pending;
      }
      expect(repository.update).toHaveBeenLastCalledWith(
        'run-id',
        expect.objectContaining({ status: 'FAILED', error: 'PROVIDER_TIMEOUT' }),
      );
      expect(log.mock.calls.some((call) => String(call[0]).includes('status=DONE'))).toBe(false);
      expect(collided).toBe(false);
      expect(writesInFlight).toBe(0);
    },
  );
  it('não aguarda consulta que nunca termina para responder indisponível', async () => {
    jest.useFakeTimers();
    environment.AI_TIMEOUT_MS = 10;
    repository.create.mockImplementation(() => new Promise(() => undefined));
    const pending = expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    await jest.advanceTimersByTimeAsync(11);
    await pending;
    expect(client.complete).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('falha da limpeza tardia registra somente categoria fixa', async () => {
    jest.useFakeTimers();
    environment.AI_TIMEOUT_MS = 10;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    repository.create.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 'run-id' }), 50)),
    );
    repository.update.mockRejectedValue(new Error('chave e objetivo privados'));
    const pending = expect(run()).rejects.toMatchObject({ response: { error: 'AI_UNAVAILABLE' } });
    await jest.advanceTimersByTimeAsync(11);
    await pending;
    await jest.advanceTimersByTimeAsync(50);
    expect(warn).toHaveBeenCalledWith('AI_TIMEOUT_AUDIT_FAILED');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('chave e objetivo privados');
  });
});
