import { UsersRepository } from './users.repository';
import { PrismaService } from '../../database/prisma.service';
describe('UsersRepository', () => {
  it('busca login somente na conta única ativa não excluída', async () => {
    const findFirst = jest.fn();
    const repository = new UsersRepository({ user: { findFirst } } as unknown as PrismaService);
    await repository.findForLogin('owner@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: 'owner@example.test', singletonKey: 1, isActive: true, deletedAt: null },
    });
  });

  it('associa o usuário legado à organização informada em uma transação', async () => {
    const owner = { id: 'owner-id', organizationId: null };
    const organization = { id: 'organization-id', name: 'Cliente Real', slug: 'cliente-real' };
    const findMany = jest.fn().mockResolvedValue([owner]);
    const create = jest.fn().mockResolvedValue(organization);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const transaction = jest.fn().mockImplementation(async (work) =>
      work({ user: { findMany, updateMany }, organization: { create } }),
    );
    const repository = new UsersRepository({ $transaction: transaction } as unknown as PrismaService);

    await repository.associateLegacyOwner({ name: 'Cliente Real', slug: 'cliente-real' });

    expect(findMany).toHaveBeenCalledWith({ take: 2 });
    expect(create).toHaveBeenCalledWith({ data: { name: 'Cliente Real', slug: 'cliente-real' } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: owner.id, organizationId: null },
      data: { organizationId: organization.id },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('recusa vínculo já feito sem criar outra organização', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'owner-id', organizationId: 'existing' }]);
    const create = jest.fn();
    const transaction = jest.fn().mockImplementation(async (work) =>
      work({ user: { findMany }, organization: { create } }),
    );
    const repository = new UsersRepository({ $transaction: transaction } as unknown as PrismaService);

    await expect(
      repository.associateLegacyOwner({ name: 'Outro', slug: 'outro' }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
