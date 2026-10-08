import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiEngine, AiRun, AiRunStatus } from '@prisma/client';
type AiRunSummary = Pick<
  AiRun,
  | 'id'
  | 'engine'
  | 'promptName'
  | 'promptVersion'
  | 'provider'
  | 'model'
  | 'status'
  | 'tokensIn'
  | 'tokensOut'
  | 'costUsd'
  | 'latencyMs'
  | 'error'
  | 'createdAt'
  | 'updatedAt'
>;
export class AiRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AiEngine }) engine!: AiEngine;
  @ApiProperty() promptName!: string;
  @ApiProperty() promptVersion!: number;
  @ApiProperty() provider!: string;
  @ApiProperty() model!: string;
  @ApiProperty({ enum: AiRunStatus }) status!: AiRunStatus;
  @ApiPropertyOptional({ nullable: true }) tokensIn!: number | null;
  @ApiPropertyOptional({ nullable: true }) tokensOut!: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) costUsd!: string | null;
  @ApiPropertyOptional({ nullable: true }) latencyMs!: number | null;
  @ApiPropertyOptional({ nullable: true }) error!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  static fromEntity(run: AiRunSummary): AiRunResponseDto {
    return {
      id: run.id,
      engine: run.engine,
      promptName: run.promptName,
      promptVersion: run.promptVersion,
      provider: run.provider,
      model: run.model,
      status: run.status,
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      costUsd: run.costUsd?.toFixed(10) ?? null,
      latencyMs: run.latencyMs,
      error: run.error,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    };
  }
}
