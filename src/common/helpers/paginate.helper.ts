import { PaginationDto } from '../dto/pagination.dto';
import { PaginationMeta } from '../interfaces/api-response.interface';

export type WhereInput = Record<string, unknown>;

export interface FindManyArgs {
  where?: WhereInput;
  skip?: number;
  take?: number;
  orderBy?: unknown;
  include?: unknown;
  select?: unknown;
}

export interface CountArgs {
  where?: WhereInput;
}

export interface PaginatableModel<T> {
  findMany(args: FindManyArgs): Promise<T[]>;
  count(args: CountArgs): Promise<number>;
}

export interface PaginateOptions {
  orderBy?: unknown;
  include?: unknown;
  select?: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export async function paginate<T>(
  model: PaginatableModel<T>,
  pagination: PaginationDto,
  where: WhereInput = {},
  options: PaginateOptions = {},
): Promise<PaginatedResult<T>> {
  const { page, limit, skip } = pagination;

  const [items, total] = await Promise.all([
    model.findMany({ where, skip, take: limit, ...options }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
