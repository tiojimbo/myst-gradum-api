import { BadRequestException } from '@nestjs/common';
import { QueryDto, SortOrder, filterKey } from '../dto/query.dto';
import { WhereInput } from './paginate.helper';

export type FilterType = 'exact' | 'like' | 'gte' | 'lte' | 'in';

export interface FilterConfig {
  searchColumns?: string[];
  allowedFilters?: Record<string, FilterType>;
}

export interface QueryParams {
  where: WhereInput;
  orderBy?: Record<string, SortOrder>;
}

function readRaw(query: QueryDto, key: string): unknown {
  return (query as unknown as Record<string, unknown>)[key];
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return String(value).split(',');
}

function buildCondition(type: FilterType, value: unknown): unknown {
  switch (type) {
    case 'exact':
      return value;
    case 'like':
      return { contains: value, mode: 'insensitive' };
    case 'gte':
      return { gte: value };
    case 'lte':
      return { lte: value };
    case 'in':
      return { in: toList(value) };
  }
}

function sortableColumns(config: FilterConfig): string[] {
  return [
    ...(config.searchColumns ?? []),
    ...Object.keys(config.allowedFilters ?? {}),
  ];
}

function rejectSortBy(field: string): never {
  throw new BadRequestException({
    message: 'Validation failed',
    error: 'Bad Request',
    details: [{ field: 'sortBy', message: `${field} não é ordenável` }],
  });
}

export function applyQueryParams(
  query: QueryDto,
  config: FilterConfig,
): QueryParams {
  const where: WhereInput = {};

  if (!isEmpty(query.search) && config.searchColumns?.length) {
    where.OR = config.searchColumns.map((column) => ({
      [column]: { contains: query.search, mode: 'insensitive' },
    }));
  }

  for (const [field, type] of Object.entries(config.allowedFilters ?? {})) {
    const value = readRaw(query, filterKey(field));

    if (isEmpty(value)) {
      continue;
    }

    where[field] = buildCondition(type, value);
  }

  const { sortBy } = query;

  if (sortBy === undefined || sortBy === '') {
    return { where };
  }

  if (!sortableColumns(config).includes(sortBy)) {
    rejectSortBy(sortBy);
  }

  return { where, orderBy: { [sortBy]: query.sortOrder } };
}
