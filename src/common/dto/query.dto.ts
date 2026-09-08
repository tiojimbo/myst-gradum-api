import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export type SortOrder = 'asc' | 'desc';

export const SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];

export const FILTER_PREFIX = 'filter';

export function filterKey(field: string): string {
  return `${FILTER_PREFIX}[${field}]`;
}

export class QueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder: SortOrder = 'desc';
}
