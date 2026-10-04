import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { createOrganization } from '../src/cli/create-organization';
import { createUser } from '../src/cli/create-user';
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    if (app.get(ConfigService).get<string>('NODE_ENV') === 'production')
      throw new Error('Seed indisponível em produção');
  } finally {
    await app.close();
  }
  await createOrganization();
  await createUser();
}
void seed().catch(() => {
  Logger.overrideLogger(new ConsoleLogger());
  new Logger('Seed').error('Seed não executado');
  process.exitCode = 1;
});
