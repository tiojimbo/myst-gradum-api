import { PaginationDto } from '../dto/pagination.dto';
import {
  FindManyArgs,
  PaginatableModel,
  WhereInput,
  paginate,
} from './paginate.helper';

interface Row {
  id: number;
}

interface FakeModel {
  model: PaginatableModel<Row>;
  findManyCalls: FindManyArgs[];
  countCalls: WhereInput[];
}

function createFakeModel(total: number): FakeModel {
  const rows: Row[] = Array.from({ length: total }, (_, index) => ({
    id: index + 1,
  }));
  const findManyCalls: FindManyArgs[] = [];
  const countCalls: WhereInput[] = [];

  return {
    findManyCalls,
    countCalls,
    model: {
      findMany(args: FindManyArgs): Promise<Row[]> {
        findManyCalls.push(args);
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;

        return Promise.resolve(rows.slice(skip, skip + take));
      },
      count(args: { where?: WhereInput }): Promise<number> {
        countCalls.push(args.where ?? {});

        return Promise.resolve(rows.length);
      },
    },
  };
}

function createPagination(page: number, limit: number): PaginationDto {
  const pagination = new PaginationDto();
  pagination.page = page;
  pagination.limit = limit;

  return pagination;
}

describe('paginate', () => {
  it('calcula a primeira página de 142 itens', async () => {
    const { model } = createFakeModel(142);

    const result = await paginate(model, createPagination(1, 20));

    expect(result.items).toHaveLength(20);
    expect(result.meta).toEqual({
      total: 142,
      page: 1,
      limit: 20,
      totalPages: 8,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('marca os dois vizinhos numa página do meio', async () => {
    const { model } = createFakeModel(142);

    const result = await paginate(model, createPagination(4, 20));

    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('fecha a última página sem próxima', async () => {
    const { model } = createFakeModel(142);

    const result = await paginate(model, createPagination(8, 20));

    expect(result.items).toHaveLength(2);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('não devolve NaN quando o total é zero', async () => {
    const { model } = createFakeModel(0);

    const result = await paginate(model, createPagination(1, 20));

    expect(result.items).toEqual([]);
    expect(result.meta.totalPages).toBe(0);
    expect(Number.isNaN(result.meta.totalPages)).toBe(false);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('trata página única quando o total cabe no limite', async () => {
    const { model } = createFakeModel(20);

    const result = await paginate(model, createPagination(1, 20));

    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('deriva o skip do PaginationDto como (page - 1) * limit', () => {
    expect(createPagination(4, 20).skip).toBe(60);
    expect(createPagination(1, 20).skip).toBe(0);
    expect(new PaginationDto().skip).toBe(0);
  });

  it('repassa skip, take e where para o model', async () => {
    const { model, findManyCalls, countCalls } = createFakeModel(142);
    const where: WhereInput = { deletedAt: null };

    await paginate(model, createPagination(4, 20), where, {
      orderBy: { createdAt: 'desc' },
    });

    expect(findManyCalls).toHaveLength(1);
    expect(findManyCalls[0]).toEqual({
      where,
      skip: 60,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    expect(countCalls).toEqual([where]);
  });
});
