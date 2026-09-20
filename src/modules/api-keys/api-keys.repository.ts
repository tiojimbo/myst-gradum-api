import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuthPrincipal } from '../auth/types/auth-principal.type';
@Injectable()
export class ApiKeysRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OwnerScopeService,
  ) {}
  async authenticate(key: string): Promise<AuthPrincipal> {
    if (!/^pk_[0-9a-f]{64}$/.test(key)) throw new UnauthorizedException('Credencial inválida');
    const keyHash = createHash('sha256').update(key).digest('hex');
    const record = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        deletedAt: null,
        user: { isActive: true, deletedAt: null },
      },
    });
    if (!record) throw new UnauthorizedException('Credencial inválida');
    return { userId: record.userId, credentialType: 'api-key', apiKeyId: record.id };
  }
  create(data: { name: string; keyHash: string; keySuffix: string }) {
    return this.prisma.apiKey.create({ data: { ...data, userId: this.scope.where().userId } });
  }
  async list(pagination: PaginationDto) {
    const where = this.scope.where();
    const [items, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        skip: pagination.skip,
        take: Math.min(pagination.limit, 100),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.apiKey.count({ where }),
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
  async revoke(id: string) {
    const where = { ...this.scope.where(), id };
    const found = await this.prisma.apiKey.findFirst({ where });
    if (!found) throw new NotFoundException('Chave não encontrada');
    if (!found.revokedAt)
      await this.prisma.apiKey.updateMany({
        where: { ...where, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    const updated = await this.prisma.apiKey.findFirst({ where });
    if (!updated) throw new NotFoundException('Chave não encontrada');
    return updated;
  }
}
