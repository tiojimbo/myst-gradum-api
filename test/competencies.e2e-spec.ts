import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestApp, ownerInput } from './helpers/auth-test-app';

describe('Competências privadas', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;

  beforeAll(async () => {
    test = await createTestApp();
    const login = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    token = login.body.data.accessToken as string;
  }, 30000);

  afterAll(async () => {
    await test?.close();
  });

  it('lista apenas as raízes da pessoa autenticada', async () => {
    const response = await request(test.app.getHttpServer())
      .get('/api/v1/competencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.pagination.total).toBe(0);
  });
});

describe('Competências por pessoa e organização', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  let ownerToken: string;
  let colleagueToken: string;
  let otherToken: string;
  let rootId: string;
  let childId: string;
  let colleagueId: string;
  let otherId: string;

  beforeAll(async () => {
    test = await createTestApp();
    const otherOrganization = await test.users.createOrganization({
      name: 'Outra organização',
      slug: 'outra-organizacao',
    });
    const colleague = await test.users.createUser({
      organizationSlug: ownerInput.organizationSlug,
      email: 'colega@example.test',
      name: 'Colega',
      password: ownerInput.password,
    });
    const other = await test.users.createUser({
      organizationSlug: 'outra-organizacao',
      email: 'outro@example.test',
      name: 'Outro',
      password: ownerInput.password,
    });
    const login = async (email: string) => {
      const response = await request(test.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: ownerInput.password })
        .expect(200);
      return response.body.data.accessToken as string;
    };
    [ownerToken, colleagueToken, otherToken] = await Promise.all([
      login(ownerInput.email),
      login(colleague.email),
      login(other.email),
    ]);
    const root = await test.prisma.skill.create({
      data: {
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        name: 'Planejar uma produção',
        kind: 'PROCEDURAL',
        masteryCriterion: 'Produz um plano viável',
      },
    });
    rootId = root.id;
    const child = await test.prisma.skill.create({
      data: {
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        parentId: root.id,
        name: 'Definir orçamento',
        kind: 'SKILL',
        masteryCriterion: 'Estima custos e justifica escolhas',
      },
    });
    childId = child.id;
    await test.prisma.skillDependency.create({
      data: {
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        skillId: child.id,
        prerequisiteId: root.id,
      },
    });
    colleagueId = (
      await test.prisma.skill.create({
        data: {
          organizationId: test.organization!.id,
          userId: colleague.id,
          name: 'Competência do colega',
          kind: 'CONCEPTUAL',
          masteryCriterion: 'Explica o conceito',
        },
      })
    ).id;
    otherId = (
      await test.prisma.skill.create({
        data: {
          organizationId: otherOrganization.id,
          userId: other.id,
          name: 'Competência de outro cliente',
          kind: 'FACTUAL',
          masteryCriterion: 'Identifica fatos relevantes',
        },
      })
    ).id;
  }, 30000);

  afterAll(async () => {
    await test?.close();
  });

  const req = () => request(test.app.getHttpServer());

  it('pagina só as raízes da pessoa e não inclui colegas', async () => {
    const response = await req()
      .get('/api/v1/competencies?page=1&limit=1')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([rootId]);
    expect(response.body.data[0].hasChildren).toBe(true);
    expect(response.body.meta.pagination.total).toBe(1);
    await req()
      .get('/api/v1/competencies?limit=101')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('lista filhos imediatos e pré-requisitos tipados', async () => {
    const response = await req()
      .get(`/api/v1/competencies?parentId=${rootId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(response.body.data.map((item: { id: string }) => item.id)).toEqual([childId]);
    expect(response.body.data[0].prerequisites).toEqual([
      expect.objectContaining({ id: rootId, name: 'Planejar uma produção' }),
    ]);
    expect(response.body.data[0].hasChildren).toBe(false);
  });

  it('pagina pré-requisitos sem revelar competência alheia', async () => {
    const response = await req()
      .get(`/api/v1/competencies/${childId}/prerequisites?page=1&limit=1`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: rootId, name: 'Planejar uma produção' }),
    ]);
    expect(response.body.meta.pagination.total).toBe(1);
    await req()
      .get(`/api/v1/competencies/${colleagueId}/prerequisites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('não revela nós de colega ou de outra organização', async () => {
    for (const id of [colleagueId, otherId]) {
      await req()
        .get(`/api/v1/competencies/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
      await req()
        .get(`/api/v1/competencies?parentId=${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    }
    await req()
      .get(`/api/v1/competencies/${rootId}`)
      .set('Authorization', `Bearer ${colleagueToken}`)
      .expect(404);
    await req()
      .get(`/api/v1/competencies/${rootId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('valida credencial e IDs', async () => {
    await req().get('/api/v1/competencies').expect(401);
    await req()
      .get('/api/v1/competencies/not-a-uuid')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
    await req()
      .get(`/api/v1/competencies?parentId=${randomUUID()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('oculta competência e pré-requisito excluídos', async () => {
    await test.prisma.skill.update({
      where: { id: rootId },
      data: { deletedAt: new Date() },
    });
    await req()
      .get(`/api/v1/competencies/${rootId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
    const child = await req()
      .get(`/api/v1/competencies/${childId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(child.body.data.prerequisites).toEqual([]);
  });
});
