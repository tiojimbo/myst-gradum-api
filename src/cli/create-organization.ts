import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';

export async function createOrganization(): Promise<void> {
  const logger = new Logger('OrganizationCreate');
  if (!stdin.isTTY || process.argv.length > 2)
    throw new Error('Execute sem argumentos em um terminal interativo');
  const prompt = createInterface({ input: stdin, output: stdout });
  let name: string;
  let slug: string;
  try {
    name = await prompt.question('Nome da organização: ');
    slug = await prompt.question('Identificador da organização: ');
  } finally {
    prompt.close();
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    await app.get(UsersService).createOrganization({ name, slug });
    Logger.overrideLogger(new ConsoleLogger());
    logger.log('Organização criada');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void createOrganization().catch(() => {
    Logger.overrideLogger(new ConsoleLogger());
    new Logger('OrganizationCreate').error('Organização não criada. Confira os dados informados.');
    process.exitCode = 1;
  });
}
