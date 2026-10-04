import { ApiKeysRepository } from './api-keys.repository';
import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
describe('ApiKeysRepository escopo', () => {
  const where = {
    userId: 'owner',
    user: { organizationId: 'org-a', organization: { deletedAt: null } },
    deletedAt: null,
  };
  const scope = { where: () => where } as unknown as OwnerScopeService;
  it('listagem e contagem usam proprietário e exclusão lógica', async () => {
    const findMany = jest.fn().mockResolvedValue([]),
      count = jest.fn().mockResolvedValue(0);
    const repository = new ApiKeysRepository(
      { apiKey: { findMany, count } } as unknown as PrismaService,
      scope,
    );
    await repository.list(new PaginationDto());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 20 }),
    );
    expect(count).toHaveBeenCalledWith({ where });
  });
  it('revogação filtra proprietário também na alteração', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'key', revokedAt: null });
    const updateMany = jest.fn();
    await new ApiKeysRepository(
      { apiKey: { findFirst, updateMany } } as unknown as PrismaService,
      scope,
    ).revoke('key');
    expect(updateMany).toHaveBeenCalledWith({
      where: { ...where, id: 'key', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
  it('autentica chave apenas com organização existente e deriva seu ID do banco', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'key-id',
      userId: 'owner',
      user: { organizationId: 'org-a' },
    });
    const repository = new ApiKeysRepository(
      { apiKey: { findFirst } } as unknown as PrismaService,
      scope,
    );
    await expect(repository.authenticate(`pk_${'a'.repeat(64)}`)).resolves.toEqual({
      userId: 'owner',
      organizationId: 'org-a',
      credentialType: 'api-key',
      apiKeyId: 'key-id',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        user: { isActive: true, deletedAt: null, organization: { deletedAt: null } },
      }),
      include: { user: true },
    });
  });
  it('nega antes de consultar banco quando não há principal', async () => {
    const repository = new ApiKeysRepository(
      {} as PrismaService,
      {
        where: () => {
          throw new Error('unauthenticated');
        },
      } as unknown as OwnerScopeService,
    );
    await expect(repository.list(new PaginationDto())).rejects.toThrow('unauthenticated');
  });
});
