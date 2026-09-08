import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  API_PREFIX,
  VALIDATION_PIPE_OPTIONS,
} from 'src/common/constants/app.constants';
import { AllExceptionsFilter } from 'src/common/filters/http-exception.filter';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { ResponseInterceptor } from 'src/common/interceptors/response.interceptor';
import { AppModule } from 'src/app.module';

const ISO_8601_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new ResponseInterceptor(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde 200 no envelope padrao, sem "database"', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/health',
    );

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
    const response = await request(app.getHttpServer()).get(
      '/api/v1/nao-existe',
    );

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
      const response = await request(app.getHttpServer()).get(
        '/api/v1/health',
      );

      expect(response.status).toBe(200);
    }
  });
});
