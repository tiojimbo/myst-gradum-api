import request from 'supertest';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';
import { randomUUID } from 'node:crypto';
import { ContextIdFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AiRunsRepository } from '../src/modules/ai/ai-runs.repository';
import { AiGatewayService } from '../src/modules/ai/ai-gateway.service';
import { OpenRouterClient } from '../src/modules/ai/openrouter.client';
import { PromptRegistry } from '../src/modules/ai/prompt.registry';

describe('Execuções privadas de IA HTTP', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let colleagueToken: string;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp();
    const response = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password });
    token = response.body.data.accessToken;
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });
  it('lista execuções com envelope e paginação mesmo com IA desligada', async () => {
    const response = await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.pagination).toMatchObject({ page: 1, limit: 20, total: 0 });
  });
  it('isola histórico e total de colegas, outras organizações e excluídos', async () => {
    const colleague = await test.users.createUser({
      ...ownerInput,
      email: 'ai-colleague@example.test',
    });
    const otherOrg = await test.users.createOrganization({ name: 'Outra', slug: 'ai-other' });
    const other = await test.users.createUser({
      ...ownerInput,
      organizationSlug: otherOrg.slug,
      email: 'ai-other@example.test',
    });
    const base = {
      engine: 'GOAL' as const,
      promptName: 'base.system',
      promptVersion: 1,
      model: 'test/model',
      input: { goal: 'conteúdo privado' },
    };
    const mine = await test.prisma.aiRun.create({
      data: {
        ...base,
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        status: 'DONE',
        output: { answer: 'privado' },
        costUsd: '0.1234567890',
      },
    });
    await test.prisma.aiRun.create({
      data: {
        ...base,
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        engine: 'DIAGNOSTIC',
        status: 'FAILED',
      },
    });
    await test.prisma.aiRun.create({
      data: {
        ...base,
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        deletedAt: new Date(),
      },
    });
    const theirs = await test.prisma.aiRun.create({
      data: { ...base, organizationId: test.organization!.id, userId: colleague.id },
    });
    await test.prisma.aiRun.create({
      data: { ...base, organizationId: otherOrg.id, userId: other.id },
    });
    const response = await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs?engine=GOAL&status=DONE&limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([mine.id]);
    expect(response.body.meta.pagination.total).toBe(1);
    expect(response.body.data[0].costUsd).toBe('0.1234567890');
    expect(JSON.stringify(response.body)).not.toContain('conteúdo privado');
    expect(response.body.data[0]).not.toHaveProperty('input');
    expect(response.body.data[0]).not.toHaveProperty('output');
    const all = await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs?limit=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(all.body.meta.pagination).toMatchObject({ total: 2, totalPages: 2, hasNextPage: true });
    const login = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: colleague.email, password: ownerInput.password });
    colleagueToken = login.body.data.accessToken;
    const colleagueList = await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${colleagueToken}`)
      .expect(200);
    expect(colleagueList.body.data.map((item: { id: string }) => item.id)).toEqual([theirs.id]);
  });
  it('valida filtros, paginação e recusa seleção de proprietário', async () => {
    for (const query of [
      'limit=101',
      'engine=UNKNOWN',
      'status=UNKNOWN',
      `userId=${randomUUID()}`,
    ]) {
      await request(test.app.getHttpServer())
        .get(`/api/v1/ai/runs?${query}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    }
  });
  it('aplica dez acessos por pessoa sem compartilhar cota por IP', async () => {
    const quotaUser = await test.users.createUser({
      ...ownerInput,
      email: 'ai-quota@example.test',
    });
    const login = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: quotaUser.email, password: ownerInput.password });
    const quotaToken = login.body.data.accessToken;
    for (let index = 0; index < 10; index++)
      await request(test.app.getHttpServer())
        .get('/api/v1/ai/runs')
        .set('Authorization', `Bearer ${quotaToken}`)
        .expect(200);
    await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${quotaToken}`)
      .expect(429);
    await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${colleagueToken}`)
      .expect(200);
    await request(test.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${quotaToken}`)
      .expect(200);
  });
  it('recusa credencial ausente, chave de API e sessão revogada', async () => {
    await request(test.app.getHttpServer()).get('/api/v1/ai/runs').expect(401);
    const key = await request(test.app.getHttpServer())
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Chave' });
    await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${key.body.data.key}`)
      .expect(403);
    await request(test.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${colleagueToken}`)
      .send({})
      .expect(200);
    await request(test.app.getHttpServer())
      .get('/api/v1/ai/runs')
      .set('Authorization', `Bearer ${colleagueToken}`)
      .expect(401);
  });
  it('gateway interno persiste somente saída validada no escopo autenticado', async () => {
    const context = ContextIdFactory.create();
    test.app.registerRequestByContextId(
      {
        user: {
          organizationId: test.organization!.id,
          userId: test.owner!.id,
          credentialType: 'jwt',
        },
      },
      context,
    );
    const repository = await test.app.resolve(AiRunsRepository, context, { strict: false });
    const config = new ConfigService({
      _PROCESS_ENV_VALIDATED: {
        AI_ENABLED: true,
        AI_MODEL_DEFAULT: 'test/model',
        OPENROUTER_API_KEY: 'fake-key',
        AI_TIMEOUT_MS: 1000,
      },
    });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            model: 'effective/model',
            choices: [{ message: { content: '{"answer":"validado"}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 3, cost: 0.001 },
          }),
        ),
      );
    const gateway = new AiGatewayService(
      config,
      repository,
      new OpenRouterClient(config),
      new PromptRegistry(),
    );
    try {
      await expect(
        gateway.run(
          'GOAL',
          { name: 'base.system', version: 1 },
          { goal: 'Objetivo privado' },
          {
            schema: z.object({ answer: z.string() }),
            jsonSchema: { type: 'object', properties: { answer: { type: 'string' } } },
          },
        ),
      ).resolves.toEqual({ answer: 'validado' });
      const run = await test.prisma.aiRun.findFirstOrThrow({ where: { model: 'effective/model' } });
      expect(run).toMatchObject({
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        status: 'DONE',
        input: { goal: 'Objetivo privado' },
        output: { answer: 'validado' },
        tokensIn: 10,
        tokensOut: 3,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const colleagueContext = ContextIdFactory.create();
      const colleague = await test.prisma.user.findUniqueOrThrow({
        where: { email: 'ai-colleague@example.test' },
      });
      test.app.registerRequestByContextId(
        {
          user: {
            organizationId: test.organization!.id,
            userId: colleague.id,
            credentialType: 'jwt',
          },
        },
        colleagueContext,
      );
      const colleagueRepository = await test.app.resolve(AiRunsRepository, colleagueContext, {
        strict: false,
      });
      await expect(colleagueRepository.update(run.id, { status: 'FAILED' })).rejects.toThrow(
        'AI_AUDIT_NOT_FOUND',
      );
      expect((await test.prisma.aiRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
        'DONE',
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
