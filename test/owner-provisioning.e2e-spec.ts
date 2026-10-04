import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createTestApp, ownerInput, silenceLogs } from './helpers/auth-test-app';
import { createOrganization as createOrganizationCommand } from '../src/cli/create-organization';
import { createUser as createUserCommand } from '../src/cli/create-user';

describe('Provisionamento multi-tenant', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp(false);
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });

  it('aceita nomes iguais de organização, mas não identificador repetido', async () => {
    await test.users.createOrganization({ name: 'Mesmo nome', slug: 'cliente-um' });
    await test.users.createOrganization({ name: 'Mesmo nome', slug: 'cliente-dois' });
    await expect(
      test.users.createOrganization({ name: 'Outro nome', slug: 'cliente-um' }),
    ).rejects.toThrow();
    expect(await test.prisma.organization.count()).toBe(2);
  });

  it('cria pessoas em organizações distintas sem duplicar identidade', async () => {
    const first = await test.users.createUser({ ...ownerInput, organizationSlug: 'cliente-um' });
    const second = await test.users.createUser({
      ...ownerInput,
      organizationSlug: 'cliente-dois',
      email: 'outra@example.test',
    });
    expect(first.organizationId).not.toBe(second.organizationId);
    expect(first.hashedPassword).toMatch(/^\$2[ab]\$12\$/);
    expect(second.hashedPassword).toMatch(/^\$2[ab]\$12\$/);
    await expect(
      test.users.createUser({ ...ownerInput, organizationSlug: 'cliente-dois' }),
    ).rejects.toThrow();
    expect(await test.prisma.user.count()).toBe(2);
  });

  it('rejeita senha inválida e organização inexistente sem registro parcial', async () => {
    await expect(
      test.users.createUser({ ...ownerInput, organizationSlug: 'cliente-um', password: 'curta' }),
    ).rejects.toThrow();
    await expect(
      test.users.createUser({
        ...ownerInput,
        organizationSlug: 'inexistente',
        email: 'nova@example.test',
      }),
    ).rejects.toThrow();
    expect(await test.prisma.user.count()).toBe(2);
  });

  it('dois cadastros concorrentes de e-mail igual criam uma pessoa só', async () => {
    const results = await Promise.allSettled([
      test.users.createUser({
        ...ownerInput,
        organizationSlug: 'cliente-um',
        email: 'concorrente@example.test',
      }),
      test.users.createUser({
        ...ownerInput,
        organizationSlug: 'cliente-dois',
        email: 'concorrente@example.test',
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await test.prisma.user.count({ where: { email: 'concorrente@example.test' } })).toBe(1);
  });

  it('não vincula pessoa nova a organização excluída', async () => {
    const organization = await test.prisma.organization.findFirstOrThrow({
      where: { slug: 'cliente-dois' },
    });
    await test.prisma.organization.update({
      where: { id: organization.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      test.users.createUser({
        ...ownerInput,
        organizationSlug: 'cliente-dois',
        email: 'apos-exclusao@example.test',
      }),
    ).rejects.toThrow();
    expect(await test.prisma.user.count({ where: { email: 'apos-exclusao@example.test' } })).toBe(0);
  });
});

describe('Comandos administrativos', () => {
  it('recusa execução sem terminal interativo', async () => {
    await expect(createOrganizationCommand()).rejects.toThrow('terminal interativo');
    await expect(createUserCommand()).rejects.toThrow('terminal interativo');
  });
});

describe('Migração B em base legada', () => {
  it('falha sem associação, permite recuperar e preserva conta, sessão e chave', async () => {
    const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
    const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const ownerId = randomUUID();
    const organizationId = randomUUID();
    const sessionId = randomUUID();
    const keyId = randomUUID();
    const prismaCommand = (args: string[]) =>
      execFileSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
        env,
        stdio: 'pipe',
      });
    try {
      for (const name of [
        '20260914000000_init_owner_auth',
        '20261003000000_expand_organizations',
      ]) {
        prismaCommand(['migrate', 'resolve', '--applied', name]);
        const sql = readFileSync(join(process.cwd(), `prisma/migrations/${name}/migration.sql`), 'utf8');
        for (const statement of sql.split(';')) {
          const command = statement.replace(/^--.*$/gm, '').trim();
          if (command) await prisma.$executeRawUnsafe(command);
        }
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

      expect(() => prismaCommand(['migrate', 'deploy'])).toThrow();
      const before = await prisma.$queryRaw<{ organization_id: string | null; singleton_key: number }[]>`
        SELECT organization_id, singleton_key FROM users WHERE id = ${ownerId}::uuid
      `;
      expect(before).toEqual([{ organization_id: null, singleton_key: 1 }]);

      prismaCommand(['migrate', 'resolve', '--rolled-back', '20261004000000_enforce_multi_tenant']);
      await prisma.$executeRawUnsafe(
        'INSERT INTO organizations (id, name, slug, updated_at) VALUES ($1::uuid, $2, $3, NOW())',
        organizationId,
        'Organização indicada',
        'organizacao-indicada',
      );
      await prisma.$executeRawUnsafe(
        'UPDATE users SET organization_id = $1::uuid WHERE id = $2::uuid',
        organizationId,
        ownerId,
      );
      prismaCommand(['migrate', 'deploy']);

      const after = await prisma.$queryRaw<{ organization_id: string; hashed_password: string }[]>`
        SELECT organization_id, hashed_password FROM users WHERE id = ${ownerId}::uuid
      `;
      expect(after).toEqual([{ organization_id: organizationId, hashed_password: 'hash-legado' }]);
      expect(await prisma.authSession.count({ where: { id: sessionId } })).toBe(1);
      expect(await prisma.apiKey.count({ where: { id: keyId } })).toBe(1);
      const oldColumn = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = 'users' AND column_name = 'singleton_key'
      `;
      expect(oldColumn[0].count).toBe(0n);
    } finally {
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await prisma.$disconnect();
    }
  }, 30000);
});
