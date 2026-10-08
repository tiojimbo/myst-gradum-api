import { AiRunsRepository } from './ai-runs.repository';
import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { ListAiRunsQueryDto } from './dto/list-ai-runs-query.dto';
describe('AiRunsRepository', () => {
  const scope = {
    personalWhere: () => ({ organizationId: 'org-a', userId: 'user-a', deletedAt: null }),
  };
  const model = {
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const repository = new AiRunsRepository(
    { aiRun: model } as unknown as PrismaService,
    scope as unknown as OwnerScopeService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('impõe proprietário autenticado na criação', async () => {
    await repository.create({
      engine: 'GOAL',
      model: 'test/model',
      promptName: 'base.system',
      promptVersion: 1,
      input: {},
      status: 'PENDING',
    });
    expect(model.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-a', userId: 'user-a' }),
    });
  });
  it('atualiza somente execução própria ativa', async () => {
    model.updateMany.mockResolvedValue({ count: 1 });
    await repository.update('id', { status: 'DONE' });
    expect(model.updateMany).toHaveBeenCalledWith({
      where: { id: 'id', organizationId: 'org-a', userId: 'user-a', deletedAt: null },
      data: { status: 'DONE' },
    });
  });
  it('recusa atualização sem registro visível', async () => {
    model.updateMany.mockResolvedValue({ count: 0 });
    await expect(repository.update('foreign-id', { status: 'DONE' })).rejects.toThrow();
  });
  it('filtra consulta e contagem pelo mesmo proprietário e situação', async () => {
    const query = Object.assign(new ListAiRunsQueryDto(), { engine: 'GOAL', status: 'DONE' });
    await repository.list(query);
    const where = {
      organizationId: 'org-a',
      userId: 'user-a',
      deletedAt: null,
      engine: 'GOAL',
      status: 'DONE',
    };
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 20 }),
    );
    expect(model.count).toHaveBeenCalledWith({ where });
  });
});
