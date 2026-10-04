import { UsersRepository } from './users.repository';
import { PrismaService } from '../../database/prisma.service';
describe('UsersRepository', () => {
  it('busca login somente com usuário e organização não excluídos', async () => {
    const findFirst = jest.fn();
    const repository = new UsersRepository({ user: { findFirst } } as unknown as PrismaService);
    await repository.findForLogin('owner@example.test');
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        email: 'owner@example.test',
        isActive: true,
        deletedAt: null,
        organization: { deletedAt: null },
      },
    });
  });

  it('cria usuário somente na organização existente dentro de transação', async () => {
    const organization = { id: 'organization-id', slug: 'cliente-real' };
    const findFirst = jest.fn().mockResolvedValue(organization);
    const create = jest.fn().mockResolvedValue({ id: 'user-id' });
    const transaction = jest.fn().mockImplementation(async (work) =>
      work({ organization: { findFirst }, user: { create } }),
    );
    const repository = new UsersRepository({ $transaction: transaction } as unknown as PrismaService);

    await repository.createUser({
      organizationSlug: 'cliente-real',
      name: 'Pessoa',
      email: 'pessoa@example.test',
      hashedPassword: 'hash',
    });

    expect(findFirst).toHaveBeenCalledWith({ where: { slug: 'cliente-real', deletedAt: null } });
    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: organization.id,
        name: 'Pessoa',
        email: 'pessoa@example.test',
        hashedPassword: 'hash',
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('não cria usuário quando a organização inexiste', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const transaction = jest.fn().mockImplementation(async (work) =>
      work({ organization: { findFirst }, user: { create } }),
    );
    const repository = new UsersRepository({ $transaction: transaction } as unknown as PrismaService);
    await expect(
      repository.createUser({
        organizationSlug: 'inexistente',
        name: 'Pessoa',
        email: 'pessoa@example.test',
        hashedPassword: 'hash',
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

});
