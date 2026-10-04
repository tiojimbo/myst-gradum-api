import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';
describe('Provisionamento e constraints reais', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp(false);
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });
  it('rejeita senha curta', async () => {
    await expect(test.users.createOwner({ ...ownerInput, password: 'curta' })).rejects.toThrow(
      'Dados do proprietário inválidos',
    );
  });
  it('concorrência cria exatamente um proprietário sem sobrescrever', async () => {
    const results = await Promise.allSettled([
      test.users.createOwner(ownerInput),
      test.users.createOwner({ ...ownerInput, email: 'other@example.test' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await test.prisma.user.count()).toBe(1);
    const owner = await test.prisma.user.findFirstOrThrow();
    expect(owner.hashedPassword).toMatch(/^\$2[ab]\$12\$/);
    await expect(test.users.createOwner(ownerInput)).rejects.toThrow();
    expect((await test.prisma.user.findFirstOrThrow()).hashedPassword).toBe(owner.hashedPassword);
  });
  it('inserção SQL com singleton diferente é bloqueada pelo CHECK', async () => {
    await expect(
      test.prisma
        .$executeRaw`INSERT INTO users (id, singleton_key, email, name, hashed_password, updated_at) VALUES (${randomUUID()}::uuid, 2, 'second@example.test', 'Segundo', 'hash', NOW())`,
    ).rejects.toThrow();
  });
  it('exclusão lógica continua ocupando singleton', async () => {
    const owner = await test.prisma.user.findFirstOrThrow();
    await test.prisma.user.update({ where: { id: owner.id }, data: { deletedAt: new Date() } });
    await expect(
      test.users.createOwner({ ...ownerInput, email: 'third@example.test' }),
    ).rejects.toThrow();
  });
});

describe('Associação da conta legada à organização', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);
  afterAll(async () => {
    await test?.close();
  });

  it('entrada inválida não cria vínculo parcial', async () => {
    await expect(
      test.users.associateLegacyOwner({ name: ' ', slug: 'inválido' }),
    ).rejects.toThrow();
    expect(await test.prisma.organization.count()).toBe(0);
  });

  it('preserva usuário e credenciais ao associar a organização indicada pelo operador', async () => {
    const owner = test.owner!;
    const session = await test.prisma.authSession.create({ data: { userId: owner.id } });
    const apiKey = await test.prisma.apiKey.create({
      data: { userId: owner.id, name: 'Integração', keyHash: 'a'.repeat(64), keySuffix: 'aaaa' },
    });

    await test.users.associateLegacyOwner({ name: 'Cliente Real', slug: 'cliente-real' });

    const updated = await test.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(updated.organizationId).toEqual(expect.any(String));
    expect(updated.hashedPassword).toBe(owner.hashedPassword);
    expect(await test.prisma.authSession.findUnique({ where: { id: session.id } })).not.toBeNull();
    expect(await test.prisma.apiKey.findUnique({ where: { id: apiKey.id } })).not.toBeNull();
    expect(await test.prisma.organization.count()).toBe(1);
    const login = await request(test.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ownerInput.email, password: ownerInput.password })
      .expect(200);
    await request(test.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);
  });

  it('repetição não muda o vínculo nem cria organização parcial', async () => {
    await expect(
      test.users.associateLegacyOwner({ name: 'Outro Cliente', slug: 'outro-cliente' }),
    ).rejects.toThrow();
    expect(await test.prisma.organization.count()).toBe(1);
  });

  it('permite nome igual com identificador diferente, mas nunca identificador repetido', async () => {
    await expect(
      test.prisma.organization.create({ data: { name: 'Cliente Real', slug: 'outro-slug' } }),
    ).resolves.toMatchObject({ name: 'Cliente Real', slug: 'outro-slug' });
    await expect(
      test.prisma.organization.create({ data: { name: 'Outro Cliente', slug: 'cliente-real' } }),
    ).rejects.toThrow();
  });

  it('exclusão lógica de organização preserva a linha e oculta a leitura normal', async () => {
    const organization = await test.prisma.organization.findFirstOrThrow();
    await test.prisma.organization.delete({ where: { id: organization.id } });
    expect(await test.prisma.organization.findFirst({ where: { id: organization.id } })).toBeNull();
    const rows = await test.prisma.$queryRaw<{ deleted_at: Date | null }[]>`
      SELECT deleted_at FROM organizations WHERE id = ${organization.id}::uuid
    `;
    expect(rows[0].deleted_at).toBeInstanceOf(Date);
  });
});

describe('Concorrência na associação da conta legada', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);
  afterAll(async () => {
    await test?.close();
  });

  it('duas associações simultâneas não criam vínculo ou organização parcial', async () => {
    const results = await Promise.allSettled([
      test.users.associateLegacyOwner({ name: 'Cliente Um', slug: 'cliente-um' }),
      test.users.associateLegacyOwner({ name: 'Cliente Dois', slug: 'cliente-dois' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const organizations = await test.prisma.organization.findMany();
    expect(organizations).toHaveLength(1);
    const owner = await test.prisma.user.findFirstOrThrow();
    expect(owner.organizationId).toBe(organizations[0].id);
  });
});

describe('Expansão de banco F0.3 já existente', () => {
  it('aplica só a migração nova e preserva conta, sessão e chave', async () => {
    const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const ownerId = randomUUID();
    const sessionId = randomUUID();
    const keyId = randomUUID();
    try {
      execFileSync(
        process.execPath,
        [
          'node_modules/prisma/build/index.js',
          'migrate',
          'resolve',
          '--applied',
          '20260914000000_init_owner_auth',
        ],
        { env, stdio: 'pipe' },
      );
      const migration = readFileSync(
        join(process.cwd(), 'prisma/migrations/20260914000000_init_owner_auth/migration.sql'),
        'utf8',
      );
      for (const statement of migration.split(';')) {
        const sql = statement.replace(/^--.*$/gm, '').trim();
        if (sql) await prisma.$executeRawUnsafe(sql);
      }
      await prisma.$executeRawUnsafe(
        'INSERT INTO users (id, email, name, hashed_password, updated_at) VALUES ($1::uuid, $2, $3, $4, NOW())',
        ownerId,
        'legacy@example.test',
        'Conta Legada',
        'hash-legado',
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO auth_sessions (id, user_id, updated_at) VALUES ($1::uuid, $2::uuid, NOW())',
        sessionId,
        ownerId,
      );
      await prisma.$executeRawUnsafe(
        'INSERT INTO api_keys (id, user_id, name, key_hash, key_suffix, updated_at) VALUES ($1::uuid, $2::uuid, $3, $4, $5, NOW())',
        keyId,
        ownerId,
        'Chave legada',
        'b'.repeat(64),
        'bbbb',
      );

      execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
        env,
        stdio: 'pipe',
      });

      const user = await prisma.$queryRaw<{ organization_id: string | null; hashed_password: string }[]>`
        SELECT organization_id, hashed_password FROM users WHERE id = ${ownerId}::uuid
      `;
      expect(user).toEqual([{ organization_id: null, hashed_password: 'hash-legado' }]);
      expect(await prisma.authSession.count({ where: { id: sessionId } })).toBe(1);
      expect(await prisma.apiKey.count({ where: { id: keyId } })).toBe(1);
    } finally {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await prisma.$disconnect();
    }
  }, 30000);
});
