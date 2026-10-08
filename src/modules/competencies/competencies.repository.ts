import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CompetenciesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OwnerScopeService,
  ) {}

  private relations(personal: ReturnType<OwnerScopeService['personalWhere']>) {
    return {
      children: {
        where: personal,
        take: 1,
        select: { id: true },
      },
      requirements: {
        where: { ...personal, prerequisite: { deletedAt: null } },
        take: 100,
        include: { prerequisite: true },
      },
      _count: {
        select: { requirements: { where: { ...personal, prerequisite: { deletedAt: null } } } },
      },
    } satisfies Prisma.SkillInclude;
  }

  findById(id: string) {
    const personal = this.scope.personalWhere();
    return this.prisma.skill.findFirst({
      where: { ...personal, id },
      include: this.relations(personal),
    });
  }

  async list(parentId: string | null, pagination: PaginationDto) {
    const personal = this.scope.personalWhere();
    const where = { ...personal, parentId };
    const [items, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        skip: pagination.skip,
        take: Math.min(pagination.limit, 100),
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: this.relations(personal),
      }),
      this.prisma.skill.count({ where }),
    ]);
    const totalPages = Math.ceil(total / pagination.limit);
    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage: pagination.page > 1,
      },
    };
  }

  async listPrerequisites(skillId: string, pagination: PaginationDto) {
    const personal = this.scope.personalWhere();
    const where = { ...personal, skillId, prerequisite: { deletedAt: null } };
    const [items, total] = await Promise.all([
      this.prisma.skillDependency.findMany({
        where,
        skip: pagination.skip,
        take: Math.min(pagination.limit, 100),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { prerequisite: true },
      }),
      this.prisma.skillDependency.count({ where }),
    ]);
    const totalPages = Math.ceil(total / pagination.limit);
    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage: pagination.page > 1,
      },
    };
  }
}
