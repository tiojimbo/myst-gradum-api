import { createTestApp, silenceLogs } from './helpers/auth-test-app';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
describe('Migration de auditoria de IA', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;
  const logs = silenceLogs();
  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);
  afterAll(async () => {
    await test?.close();
    logs.forEach((log) => log.mockRestore());
  });
  it('cria tabela de auditoria preservando organização e pessoa', async () => {
    const rows = await test.prisma.$queryRaw<
      Array<{ name: string | null }>
    >`SELECT to_regclass('ai_runs')::text AS name`;
    expect(rows[0].name).toBe('ai_runs');
    expect(await test.prisma.user.findUnique({ where: { id: test.owner!.id } })).not.toBeNull();
  });
  it('banco recusa combinação de pessoa e organização inconsistente', async () => {
    const organization = await test.users.createOrganization({
      name: 'Outra',
      slug: 'ai-migration-other',
    });
    await expect(
      test.prisma.aiRun.create({
        data: {
          organizationId: organization.id,
          userId: test.owner!.id,
          engine: 'GOAL',
          promptName: 'base.system',
          promptVersion: 1,
          model: 'test/model',
          input: {},
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});

describe('Upgrade de IA sobre dados anteriores', () => {
  it('preserva organização, pessoa, sessão, chave e competência após migration', async () => {
    const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const databaseUrl = url.toString();
    const temporary = mkdtempSync(join(tmpdir(), 'gradum-ai-migrations-'));
    const oldPrisma = join(temporary, 'prisma');
    const oldMigrations = join(oldPrisma, 'migrations');
    const projectPrisma = join(process.cwd(), 'prisma');
    const prismaCli = join(process.cwd(), 'node_modules/prisma/build/index.js');
    const environment = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl };
    let client: PrismaClient | undefined;
    try {
      mkdirSync(oldMigrations, { recursive: true });
      copyFileSync(join(projectPrisma, 'schema.prisma'), join(oldPrisma, 'schema.prisma'));
      copyFileSync(
        join(projectPrisma, 'migrations/migration_lock.toml'),
        join(oldMigrations, 'migration_lock.toml'),
      );
      for (const migration of [
        '20260914000000_init_owner_auth',
        '20261003000000_expand_organizations',
        '20261004000000_enforce_multi_tenant',
        '20261004010000_private_competency_graph',
      ]) {
        cpSync(join(projectPrisma, 'migrations', migration), join(oldMigrations, migration), {
          recursive: true,
        });
      }
      execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy', '--schema', join(oldPrisma, 'schema.prisma')],
        { env: environment, stdio: 'pipe' },
      );
      client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const organization = await client.organization.create({
        data: { name: 'Anterior', slug: 'ai-anterior' },
      });
      const user = await client.user.create({
        data: {
          organizationId: organization.id,
          email: 'ai-anterior@example.test',
          name: 'Anterior',
          hashedPassword: 'hash-test',
        },
      });
      const session = await client.authSession.create({ data: { userId: user.id } });
      const key = await client.apiKey.create({
        data: { userId: user.id, name: 'Anterior', keyHash: 'test-hash', keySuffix: '12345678' },
      });
      const skill = await client.skill.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          name: 'Anterior',
          kind: 'CONCEPTUAL',
          masteryCriterion: 'Explica',
        },
      });
      execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy', '--schema', join(projectPrisma, 'schema.prisma')],
        { env: environment, stdio: 'pipe' },
      );
      expect(
        await client.organization.findUnique({ where: { id: organization.id } }),
      ).toMatchObject(organization);
      expect(await client.user.findUnique({ where: { id: user.id } })).toMatchObject(user);
      expect(await client.authSession.findUnique({ where: { id: session.id } })).toMatchObject(
        session,
      );
      expect(await client.apiKey.findUnique({ where: { id: key.id } })).toMatchObject(key);
      expect(await client.skill.findUnique({ where: { id: skill.id } })).toMatchObject(skill);
      expect(await client.aiRun.count()).toBe(0);
    } finally {
      await client?.$disconnect();
      const cleanup = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      try {
        await cleanup.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await cleanup.$disconnect();
        rmSync(temporary, { recursive: true, force: true });
      }
    }
  }, 30000);
});
