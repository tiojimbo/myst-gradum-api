import { THROTTLER_OPTIONS } from '@nestjs/throttler/dist/throttler.constants';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { UsersService } from '../../src/modules/users/users.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { VALIDATION_PIPE_OPTIONS } from '../../src/common/constants/app.constants';
import { ConfigService } from '@nestjs/config';
export const ownerInput = {
  email: 'owner@example.test',
  name: 'Proprietário de teste',
  password: 'SenhaDeTeste123!',
};
export async function createTestApp(provision = true) {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env },
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(THROTTLER_OPTIONS)
    .useValue([
      { name: 'short', ttl: 1000, limit: 10000 },
      { name: 'medium', ttl: 10000, limit: 10000 },
      { name: 'long', ttl: 60000, limit: 1000 },
    ])
    .compile();
  const app: INestApplication = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
  await app.init();
  const prisma = app.get(PrismaService);
  const users = app.get(UsersService);
  const owner = provision ? await users.createOwner(ownerInput) : undefined;
  return {
    app,
    prisma,
    users,
    owner,
    config: app.get(ConfigService),
    async close() {
      const url = app.get(ConfigService).getOrThrow<string>('database.url');
      const schema = new URL(url).searchParams.get('schema');
      await app.close();
      if (!schema || !/^auth_test_[a-f0-9]+$/.test(schema))
        throw new Error('Schema de teste inválido');
      const admin = new PrismaClient({ datasources: { db: { url } } });
      try {
        await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.$disconnect();
      }
    },
  };
}
export function silenceLogs() {
  return [
    jest.spyOn(Logger.prototype, 'log').mockImplementation(),
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
    jest.spyOn(Logger.prototype, 'error').mockImplementation(),
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(),
  ];
}
