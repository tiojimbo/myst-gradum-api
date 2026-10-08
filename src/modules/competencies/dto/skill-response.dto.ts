import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeKind, Prisma, Skill } from '@prisma/client';

export type SkillWithRelations = Prisma.SkillGetPayload<{
  include: {
    children: { select: { id: true } };
    requirements: { include: { prerequisite: true } };
    _count: { select: { requirements: true } };
  };
}>;

export class SkillPrerequisiteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: KnowledgeKind }) kind!: KnowledgeKind;
  @ApiProperty() targetLevel!: number;
  @ApiProperty() masteryCriterion!: string;

  static fromEntity(
    skill: Pick<Skill, 'id' | 'name' | 'kind' | 'targetLevel' | 'masteryCriterion'>,
  ): SkillPrerequisiteResponseDto {
    return {
      id: skill.id,
      name: skill.name,
      kind: skill.kind,
      targetLevel: skill.targetLevel,
      masteryCriterion: skill.masteryCriterion,
    };
  }
}

export class SkillResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) domainSlug!: string | null;
  @ApiProperty({ enum: KnowledgeKind }) kind!: KnowledgeKind;
  @ApiProperty() targetLevel!: number;
  @ApiProperty() masteryCriterion!: string;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional({ nullable: true }) parentId!: string | null;
  @ApiProperty() hasChildren!: boolean;
  @ApiProperty() hasMorePrerequisites!: boolean;
  @ApiProperty({ type: [SkillPrerequisiteResponseDto] })
  prerequisites!: SkillPrerequisiteResponseDto[];

  static fromEntity(skill: SkillWithRelations): SkillResponseDto {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      domainSlug: skill.domainSlug,
      kind: skill.kind,
      targetLevel: skill.targetLevel,
      masteryCriterion: skill.masteryCriterion,
      sortOrder: skill.sortOrder,
      parentId: skill.parentId,
      hasChildren: skill.children.length > 0,
      hasMorePrerequisites: skill._count.requirements > skill.requirements.length,
      prerequisites: skill.requirements.map(({ prerequisite }) =>
        SkillPrerequisiteResponseDto.fromEntity(prerequisite),
      ),
    };
  }
}
