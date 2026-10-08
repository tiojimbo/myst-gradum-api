import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateAiRun, UpdateAiRun } from './ai.params';
import { ListAiRunsQueryDto } from './dto/list-ai-runs-query.dto';
@Injectable()
export class AiRunsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OwnerScopeService,
  ) {}
  create(data: CreateAiRun) {
    const { organizationId, userId } = this.scope.personalWhere();
    return this.prisma.aiRun.create({
      data: {
        ...data,
        input: data.input === null ? Prisma.JsonNull : data.input,
        organizationId,
        userId,
      },
    });
  }
  async update(id: string, data: UpdateAiRun): Promise<void> {
    const { output, validationErrors, ...fields } = data;
    const updated = await this.prisma.aiRun.updateMany({
      where: { ...this.scope.personalWhere(), id },
      data: {
        ...fields,
        ...(output !== undefined ? { output: output === null ? Prisma.JsonNull : output } : {}),
        ...(validationErrors !== undefined
          ? { validationErrors: validationErrors === null ? Prisma.JsonNull : validationErrors }
          : {}),
      },
    });
    if (updated.count !== 1) throw new Error('AI_AUDIT_NOT_FOUND');
  }
  async list(query: ListAiRunsQueryDto) {
    const where: Prisma.AiRunWhereInput = {
      ...this.scope.personalWhere(),
      ...(query.engine ? { engine: query.engine } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.aiRun.findMany({
        where,
        skip: query.skip,
        take: Math.min(query.limit, 100),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          engine: true,
          promptName: true,
          promptVersion: true,
          provider: true,
          model: true,
          status: true,
          tokensIn: true,
          tokensOut: true,
          costUsd: true,
          latencyMs: true,
          error: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.aiRun.count({ where }),
    ]);
    const totalPages = Math.ceil(total / query.limit);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }
}
