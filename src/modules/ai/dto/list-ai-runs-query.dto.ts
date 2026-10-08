import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AiEngine, AiRunStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
export class ListAiRunsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AiEngine })
  @IsOptional()
  @IsEnum(AiEngine)
  engine?: AiEngine;
  @ApiPropertyOptional({ enum: AiRunStatus })
  @IsOptional()
  @IsEnum(AiRunStatus)
  status?: AiRunStatus;
}
