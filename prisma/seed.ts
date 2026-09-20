import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { createOwner } from '../scripts/create-owner';
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    if (app.get(ConfigService).get<string>('NODE_ENV') === 'production')
      throw new Error('Seed indisponível em produção');
  } finally {
    await app.close();
  }
  await createOwner();
}
void seed().catch(() => {
  Logger.overrideLogger(new ConsoleLogger());
  new Logger('Seed').error('Seed não executado');
  process.exitCode = 1;
});
