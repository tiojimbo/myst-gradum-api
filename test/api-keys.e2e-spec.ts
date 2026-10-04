import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';
describe('Chaves HTTP', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let key: string;
  let id: string;
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
  const req = () => request(test.app.getHttpServer());
  it('retorna segredo uma vez, persiste somente hash e pagina metadados', async () => {
    const response = await req()
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Integração' })
      .expect(201);
    key = response.body.data.key;
    id = response.body.data.apiKey.id;
    expect(key).toMatch(/^pk_[a-f0-9]{64}$/);
    expect(response.headers['cache-control']).toBe('no-store');
    const stored = await test.prisma.apiKey.findFirstOrThrow({ where: { id } });
    expect(stored.keyHash).toBe(createHash('sha256').update(key).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(key);
    const list = await req()
      .get('/api/v1/api-keys?page=1&limit=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.pagination.total).toBe(1);
    expect(JSON.stringify(list.body)).not.toContain(key);
    expect(JSON.stringify(list.body)).not.toContain(stored.keyHash);
    await req()
      .get('/api/v1/api-keys?limit=101')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
  it('separa os tipos em todas as rotas; credencial inválida dá 401', async () => {
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${key}`)
      .expect(200);
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', 'Bearer pk_invalida')
      .expect(401);
    await req().get('/api/v1/auth/me').set('Authorization', `Bearer ${key}`).expect(403);
    await req().get('/api/v1/api-keys').set('Authorization', `Bearer ${key}`).expect(403);
    for (const path of ['/auth/logout', '/auth/logout-all', '/api-keys', `/api-keys/${id}/revoke`])
      await req().post(`/api/v1${path}`).set('Authorization', `Bearer ${key}`).expect(403);
  });
  it('escopo/concorrência e identificação extra não trocam identidade', async () => {
    const responses = await Promise.all([
      req().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`),
      req().get('/api/v1/integrations/health').set('Authorization', `Bearer ${key}`),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await req()
      .post(`/api/v1/api-keys/${randomUUID()}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await req()
      .get('/api/v1/api-keys?ownerId=another')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await req()
      .get('/api/v1/api-keys?organizationId=another')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
  it('conta inativa e excluída bloqueiam JWT e chave', async () => {
    await test.prisma.user.update({ where: { id: test.owner!.id }, data: { isActive: false } });
    await req().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${key}`)
      .expect(401);
    await test.prisma.user.update({ where: { id: test.owner!.id }, data: { isActive: true } });
  });
  it('revogação idempotente não revoga JWT e logs não expõem segredo', async () => {
    const first = await req()
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const second = await req()
      .post(`/api/v1/api-keys/${id}/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.data.revokedAt).toBe(second.body.data.revokedAt);
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${key}`)
      .expect(401);
    await req().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(JSON.stringify(logs.map((log) => log.mock.calls))).not.toContain(key);
  });
  it('limita criação em cinco por minuto e logout preserva chave', async () => {
    const other = await req()
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    const second = other.body.data.accessToken as string;
    let active = '';
    for (let i = 0; i < 4; i += 1) {
      const response = await req()
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${i % 2 ? second : token}`)
        .send({ name: `Integração ${i}` })
        .expect(201);
      active = response.body.data.key;
    }
    await req()
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Limite' })
      .expect(429);
    await req().post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${active}`)
      .expect(200);
    await test.prisma.user.update({
      where: { id: test.owner!.id },
      data: { deletedAt: new Date() },
    });
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${active}`)
      .expect(401);
  });
});

describe('Chaves isoladas entre organizações e colegas', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let ownerToken: string;
  let colleagueToken: string;
  let otherToken: string;
  let ownerKey: string;
  let colleagueId: string;
  let otherId: string;
  beforeAll(async () => {
    test = await createTestApp();
    await test.users.createOrganization({ name: 'Outra', slug: 'outra-organizacao' });
    await test.users.createUser({
      organizationSlug: ownerInput.organizationSlug,
      email: 'colega@example.test',
      name: 'Colega',
      password: ownerInput.password,
    });
    await test.users.createUser({
      organizationSlug: 'outra-organizacao',
      email: 'outro@example.test',
      name: 'Outro',
      password: ownerInput.password,
    });
    for (const [email, assign] of [
      [ownerInput.email, (token: string) => (ownerToken = token)],
      ['colega@example.test', (token: string) => (colleagueToken = token)],
      ['outro@example.test', (token: string) => (otherToken = token)],
    ] as const) {
      const response = await request(test.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: ownerInput.password })
        .expect(200);
      assign(response.body.data.accessToken);
    }
  }, 30000);
  afterAll(async () => {
    await test?.close();
  });
  const req = () => request(test.app.getHttpServer());

  it('não lista nem revoga chave de colega ou de outra organização', async () => {
    const owner = await req()
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Minha chave' })
      .expect(201);
    ownerKey = owner.body.data.key;
    const colleague = await req()
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${colleagueToken}`)
      .send({ name: 'Chave do colega' })
      .expect(201);
    colleagueId = colleague.body.data.apiKey.id;
    const other = await req()
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Chave de outra organização' })
      .expect(201);
    otherId = other.body.data.apiKey.id;
    const list = await req()
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toEqual([owner.body.data.apiKey.id]);
    expect(list.body.meta.pagination.total).toBe(1);
    for (const id of [colleagueId, otherId])
      await req()
        .post(`/api/v1/api-keys/${id}/revoke`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
  });

  it('organização excluída invalida a chave sem afetar outra organização', async () => {
    await test.prisma.organization.update({
      where: { id: test.organization!.id },
      data: { deletedAt: new Date() },
    });
    await req()
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${ownerKey}`)
      .expect(401);
    await req()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
  });
});
