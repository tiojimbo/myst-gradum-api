import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';
describe('Auth HTTP', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });
  const get = (path: string, credential = token) =>
    request(test.app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${credential}`);
  const post = (path: string, credential = token) =>
    request(test.app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${credential}`);
  it('login retorna DTO seguro e JWT sem vencimento', async () => {
    const response = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    token = response.body.data.accessToken;
    expect(response.body.data.user).toEqual({
      id: test.owner!.id,
      name: ownerInput.name,
      email: ownerInput.email,
      onboardingCompletedAt: null,
    });
    const claims = new JwtService().decode(token);
    expect(claims).toMatchObject({
      sub: test.owner!.id,
      jti: expect.any(String),
      iat: expect.any(Number),
    });
    expect(claims).not.toHaveProperty('exp');
    expect(response.body.data).not.toHaveProperty('refreshToken');
  });
  it('nega ausência de credencial e rejeita identidade extra', async () => {
    await request(test.app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    for (const field of ['userId', 'organizationId', 'ownerId', 'workspaceId', 'role'])
      await get(`/auth/me?${field}=invasor`).expect(400);
    await post('/auth/logout').send({ userId: 'invasor' }).expect(400);
  });
  it('mantém sessão depois de oito dias e rejeita tokens malformados/legados', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86400000);
    await get('/auth/me').expect(200);
    now.mockRestore();
    const jwt = new JwtService({ secret: test.config.getOrThrow('jwt.accessSecret') });
    const claims = jwt.decode(token) as { sub: string; jti: string };
    const tokens = [
      token.slice(0, -2) + 'xx',
      jwt.sign({ ...claims, exp: 1 }),
      jwt.sign({ ...claims }, { secret: 'outro-segredo' }),
      jwt.sign({ ...claims }, { algorithm: 'HS384' }),
      jwt.sign({ ...claims, jti: randomUUID() }),
      jwt.sign({ ...claims, sub: randomUUID() }),
      jwt.sign({ sub: 3, jti: [] }),
      jwt.sign({ sub: 'não-uuid', jti: 'não-uuid' }),
    ];
    for (const invalid of tokens) await get('/auth/me', invalid).expect(401);
  });
  it('logout isolado e logout-all revogam imediatamente', async () => {
    const response = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    const second = response.body.data.accessToken as string;
    await post('/auth/logout').expect(200);
    await get('/auth/me').expect(401);
    await get('/auth/me', second).expect(200);
    await post('/auth/logout-all', second).expect(200);
    await get('/auth/me', second).expect(401);
  });
  it('não contém registro/refresh no Swagger nem handlers', async () => {
    const document = SwaggerModule.createDocument(test.app, new DocumentBuilder().build());
    expect(Object.keys(document.paths).join()).not.toMatch(/register|refresh/);
    await request(test.app.getHttpServer()).post('/api/v1/auth/register').expect(404);
    await request(test.app.getHttpServer()).post('/api/v1/auth/refresh').expect(404);
  });
  it('mesma mensagem para email/senha/conta indisponível; limita quinta tentativa', async () => {
    const responses = [];
    for (const email of ['missing@example.test', ownerInput.email])
      responses.push(
        await request(test.app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email, password: 'senhaerrada' }),
      );
    await test.prisma.user.update({ where: { id: test.owner!.id }, data: { isActive: false } });
    responses.push(
      await request(test.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ownerInput.email, password: ownerInput.password }),
    );
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('E-mail ou senha inválidos');
    }
    await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(429);
  });
});

describe('Autenticação vinculada à organização persistida', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    test = await createTestApp();
    await test.users.createOrganization({ name: 'Outra', slug: 'outra-organizacao' });
    await test.users.createUser({
      organizationSlug: 'outra-organizacao',
      email: 'outra@example.test',
      name: 'Outra pessoa',
      password: ownerInput.password,
    });
  }, 30000);
  afterAll(async () => {
    await test?.close();
  });

  it('duas organizações autenticam pessoas distintas sem trocar perfil', async () => {
    const first = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    const second = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'outra@example.test', password: ownerInput.password })
      .expect(200);
    const profiles = await Promise.all(
      [first.body.data.accessToken, second.body.data.accessToken].map((token: string) =>
        request(test.app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`),
      ),
    );
    expect(profiles.map((profile) => profile.body.data.email)).toEqual([
      ownerInput.email,
      'outra@example.test',
    ]);
  });

  it('organização excluída invalida uma sessão sem afetar a outra', async () => {
    const first = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    const second = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'outra@example.test', password: ownerInput.password })
      .expect(200);
    await test.prisma.organization.update({
      where: { id: test.organization!.id },
      data: { deletedAt: new Date() },
    });
    await request(test.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .expect(401);
    await request(test.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${second.body.data.accessToken}`)
      .expect(200);
  });
});
