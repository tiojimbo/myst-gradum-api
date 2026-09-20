import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OwnerScopeService } from './owner-scope.service';
@Global()
@Module({
  providers: [PrismaService, OwnerScopeService],
  exports: [PrismaService, OwnerScopeService],
})
export class DatabaseModule {}
