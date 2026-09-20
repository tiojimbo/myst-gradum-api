import { ApiKeysRepository } from './api-keys.repository';
import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
describe('ApiKeysRepository escopo', () => {
  const scope = { where: () => ({ userId: 'owner', deletedAt: null }) } as OwnerScopeService;
  it('listagem e contagem usam proprietário e exclusão lógica', async () => {
    const findMany = jest.fn().mockResolvedValue([]),
      count = jest.fn().mockResolvedValue(0);
    const repository = new ApiKeysRepository(
      { apiKey: { findMany, count } } as unknown as PrismaService,
      scope,
    );
    await repository.list(new PaginationDto());
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner', deletedAt: null }, skip: 0, take: 20 }),
    );
    expect(count).toHaveBeenCalledWith({ where: { userId: 'owner', deletedAt: null } });
  });
  it('revogação filtra proprietário também na alteração', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'key', revokedAt: null });
    const updateMany = jest.fn();
    await new ApiKeysRepository(
      { apiKey: { findFirst, updateMany } } as unknown as PrismaService,
      scope,
    ).revoke('key');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'key', userId: 'owner', deletedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
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
