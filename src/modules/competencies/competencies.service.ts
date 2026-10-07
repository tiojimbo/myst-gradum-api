import { Injectable, NotFoundException } from '@nestjs/common';
import { CompetenciesQueryDto } from './dto/competencies-query.dto';
import { SkillPrerequisiteResponseDto, SkillResponseDto } from './dto/skill-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CompetenciesRepository } from './competencies.repository';

@Injectable()
export class CompetenciesService {
  constructor(private readonly repository: CompetenciesRepository) {}

  async list(query: CompetenciesQueryDto) {
    if (query.parentId && !(await this.repository.findById(query.parentId)))
      throw new NotFoundException('Competência não encontrada');
    const result = await this.repository.list(query.parentId ?? null, query);
    return { ...result, items: result.items.map(SkillResponseDto.fromEntity) };
  }

  async getById(id: string) {
    const skill = await this.repository.findById(id);
    if (!skill) throw new NotFoundException('Competência não encontrada');
    return SkillResponseDto.fromEntity(skill);
  }

  async listPrerequisites(id: string, pagination: PaginationDto) {
    if (!(await this.repository.findById(id)))
      throw new NotFoundException('Competência não encontrada');
    const result = await this.repository.listPrerequisites(id, pagination);
    return {
      ...result,
      items: result.items.map(({ prerequisite }) =>
        SkillPrerequisiteResponseDto.fromEntity(prerequisite),
      ),
    };
  }
}
