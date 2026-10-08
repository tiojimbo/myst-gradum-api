import request from 'supertest';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';

describe('Aplicação com IA desligada', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });
  it('mantém login, saúde e chave de integração sem OpenRouter', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Chamada externa proibida no teste'));
    const login = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    const token = login.body.data.accessToken;
    await request(test.app.getHttpServer()).get('/api/v1/health').expect(200);
    await request(test.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const key = await request(test.app.getHttpServer())
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Integração manual' })
      .expect(201);
    await request(test.app.getHttpServer())
      .get('/api/v1/integrations/health')
      .set('Authorization', `Bearer ${key.body.data.key}`)
      .expect(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
