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
});
