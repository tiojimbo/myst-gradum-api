import { createTestApp } from './helpers/auth-test-app';
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';

const ISO_8601_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Health (e2e)', () => {
  let app: INestApplication;

  let test: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    test = await createTestApp(false);
    app = test.app;
  }, 30000);
  afterAll(async () => {
    await test?.close();
  });

  it('GET /api/v1/health responde 200 no envelope padrao, sem "database"', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok' },
      meta: {
        timestamp: expect.stringMatching(ISO_8601_MS),
        requestId: expect.any(String),
      },
    });
    expect(response.body.data).not.toHaveProperty('database');
  });

  it('ecoa o x-request-id recebido em meta.requestId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'req_teste123');

    expect(response.body.meta.requestId).toBe('req_teste123');
  });

  it('GET /api/v1/nao-existe responde 404 no formato do 8.4, sem envelope', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nao-existe');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/api/v1/nao-existe',
    });
    expect(response.body).not.toHaveProperty('data');
    expect(response.body).not.toHaveProperty('meta');
  });

  it('GET /health sem o prefixo global responde 404', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(404);
  });

  it('40 chamadas seguidas em /api/v1/health nunca recebem 429 (@SkipThrottle)', async () => {
    for (let i = 0; i < 40; i += 1) {
      const response = await request(app.getHttpServer()).get('/api/v1/health');

      expect(response.status).toBe(200);
    }
  });
  it('404 não expõe segredo da query na resposta nem nos logs', async () => {
    const secret = `pk_${'a'.repeat(64)}`;
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/nao-existe?key=${secret}`)
        .expect(404);
      expect(JSON.stringify(response.body)).not.toContain(secret);
      expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
      expect(response.body.message).toBe('Rota não encontrada');
    } finally {
      warn.mockRestore();
    }
  });
});
