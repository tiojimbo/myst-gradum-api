import { ConfigService } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client';

describe('OpenRouterClient', () => {
  const config = new ConfigService({
    OPENROUTER_API_KEY: 'test-key',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    AI_MAX_TOKENS: 4000,
    OPENROUTER_JSON_SCHEMA_MODELS: 'test/model',
    OPENROUTER_HTTP_REFERER: 'https://example.test',
    OPENROUTER_TITLE: 'Gradum',
  });
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const params = {
    model: 'test/model',
    messages: [{ role: 'system' as const, content: 'Somente JSON' }],
    schema: {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
      additionalProperties: false,
    },
    schemaName: 'test_output',
    signal: new AbortController().signal,
  };
  const response = (extra: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({
        model: 'actual/model',
        choices: [{ message: { content: '{"answer":"ok"}' } }],
        usage: { prompt_tokens: 5, completion_tokens: 7, cost: 0.002 },
        ...extra,
      }),
    );
  it('envia credencial, atribuição e JSON schema somente para modelo configurado compatível', async () => {
    fetchSpy.mockResolvedValue(response());
    const result = await new OpenRouterClient(config).complete(params);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'HTTP-Referer': 'https://example.test',
      'X-Title': 'Gradum',
    });
    expect(JSON.parse(init.body)).toMatchObject({
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: params.schema },
      },
      provider: { require_parameters: true },
      stream: false,
    });
    expect(result).toMatchObject({
      model: 'actual/model',
      tokensIn: 5,
      tokensOut: 7,
      costUsd: 0.002,
      content: '{"answer":"ok"}',
    });
  });
  it('usa instrução de JSON puro sem adivinhar suporte do modelo', async () => {
    fetchSpy.mockResolvedValue(response());
    await new OpenRouterClient(config).complete({ ...params, model: 'other/model' });
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty('response_format');
  });
  it('não expõe corpo privado do erro de provedor', async () => {
    fetchSpy.mockResolvedValue(new Response('nota privada test-key', { status: 503 }));
    await expect(new OpenRouterClient(config).complete(params)).rejects.toThrow('PROVIDER_HTTP');
  });
  it('rejeita erro embutido em HTTP 200', async () => {
    fetchSpy.mockResolvedValue(response({ error: { message: 'private' } }));
    await expect(new OpenRouterClient(config).complete(params)).rejects.toThrow('PROVIDER_ERROR');
  });
  it('devolve conteúdo ausente para validação e correção pelo gateway', async () => {
    fetchSpy.mockResolvedValue(response({ choices: [] }));
    expect((await new OpenRouterClient(config).complete(params)).content).toBeUndefined();
  });
  it('preserva ausência de uso e custo como desconhecidos', async () => {
    fetchSpy.mockResolvedValue(response({ usage: undefined }));
    const result = await new OpenRouterClient(config).complete(params);
    expect(result.tokensIn).toBeUndefined();
    expect(result.tokensOut).toBeUndefined();
    expect(result.costUsd).toBeUndefined();
  });
  it('rejeita métricas negativas sem gravar números inventados', async () => {
    fetchSpy.mockResolvedValue(
      response({ usage: { prompt_tokens: -1, completion_tokens: 3, cost: -0.1 } }),
    );
    await expect(new OpenRouterClient(config).complete(params)).rejects.toThrow(
      'PROVIDER_RESPONSE',
    );
  });
  it('abort signal continua governando a leitura do corpo após os headers', async () => {
    const abort = new AbortController();
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        new Promise((_, reject) => {
          abort.signal.addEventListener('abort', () => reject(new Error('AbortError')), {
            once: true,
          });
        }),
    });
    const pending = new OpenRouterClient(config).complete({ ...params, signal: abort.signal });
    const check = expect(pending).rejects.toThrow();
    await Promise.resolve();
    abort.abort();
    await check;
  });
});
