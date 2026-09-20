import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ApiKeysRepository } from './api-keys.repository';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
@Injectable()
export class ApiKeysService {
  constructor(private readonly repository: ApiKeysRepository) {}
  async create(dto: CreateApiKeyDto) {
    const key = `pk_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(key).digest('hex');
    const apiKey = await this.repository.create({
      name: dto.name.trim(),
      keyHash,
      keySuffix: key.slice(-8),
    });
    return { apiKey: ApiKeyResponseDto.fromEntity(apiKey), key };
  }
  async list(pagination: PaginationDto) {
    const result = await this.repository.list(pagination);
    return { ...result, items: result.items.map(ApiKeyResponseDto.fromEntity) };
  }
  async revoke(id: string) {
    return ApiKeyResponseDto.fromEntity(await this.repository.revoke(id));
  }
}
