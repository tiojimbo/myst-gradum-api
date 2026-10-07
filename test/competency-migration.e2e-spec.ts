import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createTestApp, ownerInput } from './helpers/auth-test-app';

describe('Migration do grafo privado', () => {
  let test: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    test = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await test?.close();
  });

  it('não instala competências de exemplo e preserva a conta', async () => {
    expect(await test.prisma.skill.count()).toBe(0);
    expect(await test.prisma.skillDependency.count()).toBe(0);
    expect(await test.prisma.user.findUnique({ where: { email: ownerInput.email } })).toMatchObject({
      id: test.owner!.id,
      organizationId: test.organization!.id,
    });
  });

  it('recusa associação inconsistente entre pessoa e organização', async () => {
    const otherOrganization = await test.users.createOrganization({
      name: 'Outra organização',
      slug: 'outra-organizacao',
    });
    await expect(
      test.prisma.skill.create({
        data: {
          organizationId: otherOrganization.id,
          userId: test.owner!.id,
          name: 'Nó inválido',
          kind: 'SKILL',
          masteryCriterion: 'Critério',
        },
      }),
    ).rejects.toThrow();
  });

  it('recusa pai e pré-requisito de outra pessoa', async () => {
    const colleague = await test.users.createUser({
      organizationSlug: ownerInput.organizationSlug,
      email: 'colega@example.test',
      name: 'Colega',
      password: ownerInput.password,
    });
    const mine = await test.prisma.skill.create({
      data: {
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        name: 'Minha',
        kind: 'CONCEPTUAL',
        masteryCriterion: 'Explica',
      },
    });
    const theirs = await test.prisma.skill.create({
      data: {
        organizationId: test.organization!.id,
        userId: colleague.id,
        name: 'Do colega',
        kind: 'CONCEPTUAL',
        masteryCriterion: 'Explica',
      },
    });
    await expect(
      test.prisma.skill.create({
        data: {
          organizationId: test.organization!.id,
          userId: colleague.id,
          parentId: mine.id,
          name: 'Filho inválido',
          kind: 'SKILL',
          masteryCriterion: 'Demonstra',
        },
      }),
    ).rejects.toThrow();
    await expect(
      test.prisma.skillDependency.create({
        data: {
          organizationId: test.organization!.id,
          userId: test.owner!.id,
          skillId: mine.id,
          prerequisiteId: theirs.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('recusa competência como seu próprio pai ou pré-requisito', async () => {
    const selfId = randomUUID();
    await expect(
      test.prisma.skill.create({
        data: {
          id: selfId,
          organizationId: test.organization!.id,
          userId: test.owner!.id,
          parentId: selfId,
          name: 'Pai de si',
          kind: 'SKILL',
          masteryCriterion: 'Demonstra',
        },
      }),
    ).rejects.toThrow();
    const skill = await test.prisma.skill.create({
      data: {
        organizationId: test.organization!.id,
        userId: test.owner!.id,
        name: 'Válida',
        kind: 'SKILL',
        masteryCriterion: 'Demonstra',
      },
    });
    await expect(
      test.prisma.skillDependency.create({
        data: {
          organizationId: test.organization!.id,
          userId: test.owner!.id,
          skillId: skill.id,
          prerequisiteId: skill.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('recusa nível-alvo fora da escala de 1 a 5', async () => {
    for (const targetLevel of [0, 6]) {
      await expect(
        test.prisma.skill.create({
          data: {
            organizationId: test.organization!.id,
            userId: test.owner!.id,
            name: `Nível ${targetLevel}`,
            kind: 'SKILL',
            targetLevel,
            masteryCriterion: 'Demonstra',
          },
        }),
      ).rejects.toThrow();
    }
  });
});

describe('Migration sobre dados existentes da F0.6', () => {
  it('preserva organização, pessoa, sessão e chave já gravadas', async () => {
    const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', schema);
    const databaseUrl = url.toString();
    const temporary = mkdtempSync(join(tmpdir(), 'gradum-f12-migrations-'));
    const oldPrisma = join(temporary, 'prisma');
    const oldMigrations = join(oldPrisma, 'migrations');
    const projectPrisma = join(process.cwd(), 'prisma');
    const prismaCli = join(process.cwd(), 'node_modules/prisma/build/index.js');
    const environment = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    };
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
      ]) {
        cpSync(
          join(projectPrisma, 'migrations', migration),
          join(oldMigrations, migration),
          { recursive: true },
        );
      }
      execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy', '--schema', join(oldPrisma, 'schema.prisma')],
        { env: environment, stdio: 'pipe' },
      );

      client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      const organization = await client.organization.create({
        data: { name: 'Organização anterior', slug: 'anterior' },
      });
      const user = await client.user.create({
        data: {
          organizationId: organization.id,
          email: 'anterior@example.test',
          name: 'Pessoa anterior',
          hashedPassword: 'hash-de-teste',
        },
      });
      const session = await client.authSession.create({ data: { userId: user.id } });
      const apiKey = await client.apiKey.create({
        data: {
          userId: user.id,
          name: 'Chave anterior',
          keyHash: 'hash-chave-anterior',
          keySuffix: 'anterior',
        },
      });

      execFileSync(
        process.execPath,
        [prismaCli, 'migrate', 'deploy', '--schema', join(projectPrisma, 'schema.prisma')],
        { env: environment, stdio: 'pipe' },
      );

      expect(await client.organization.findUnique({ where: { id: organization.id } })).toMatchObject({
        id: organization.id,
        slug: organization.slug,
      });
      expect(await client.user.findUnique({ where: { id: user.id } })).toMatchObject({
        id: user.id,
        organizationId: organization.id,
      });
      expect(await client.authSession.findUnique({ where: { id: session.id } })).toMatchObject({
        id: session.id,
        userId: user.id,
      });
      expect(await client.apiKey.findUnique({ where: { id: apiKey.id } })).toMatchObject({
        id: apiKey.id,
        userId: user.id,
        keyHash: apiKey.keyHash,
      });
      expect(await client.skill.count()).toBe(0);
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
