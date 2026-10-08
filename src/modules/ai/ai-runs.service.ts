import { Injectable } from '@nestjs/common';
import { AiRunsRepository } from './ai-runs.repository';
import { ListAiRunsQueryDto } from './dto/list-ai-runs-query.dto';
import { AiRunResponseDto } from './dto/ai-run-response.dto';
@Injectable()
export class AiRunsService {
  constructor(private readonly repository: AiRunsRepository) {}
  async list(query: ListAiRunsQueryDto) {
    const result = await this.repository.list(query);
    return { ...result, items: result.items.map(AiRunResponseDto.fromEntity) };
  }
}
