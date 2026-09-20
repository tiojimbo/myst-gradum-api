import { randomUUID } from 'node:crypto';
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
