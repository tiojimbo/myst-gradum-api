import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ datasources: { db: { url: config.getOrThrow<string>('database.url') } }, log: [] });
    this.$use(async (params, next) => {
      if (['Organization', 'User', 'AuthSession', 'ApiKey'].includes(params.model ?? '')) {
        if (params.action === 'delete' || params.action === 'deleteMany') {
          params.action = params.action === 'delete' ? 'update' : 'updateMany';
          params.args.data = { deletedAt: new Date() };
        }
        if (
          ['findFirst', 'findMany', 'findUnique', 'count', 'update', 'updateMany'].includes(
            params.action,
          )
        ) {
          params.args ??= {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }
      }
      return next(params);
    });
  }
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
  async checkConnection(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
