import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';

export async function associateLegacyOwner(): Promise<void> {
  const logger = new Logger('OwnerOrganizationAssociation');
  if (!stdin.isTTY || process.argv.length > 2)
    throw new Error('Execute sem argumentos em um terminal interativo');
  const prompt = createInterface({ input: stdin, output: stdout });
  let name: string;
  let slug: string;
  try {
    name = await prompt.question('Nome da organização existente: ');
    slug = await prompt.question('Identificador da organização: ');
  } finally {
    prompt.close();
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    await app.get(UsersService).associateLegacyOwner({ name, slug });
    Logger.overrideLogger(new ConsoleLogger());
    logger.log('Conta existente associada à organização');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void associateLegacyOwner().catch(() => {
    Logger.overrideLogger(new ConsoleLogger());
    new Logger('OwnerOrganizationAssociation').error(
      'Associação não concluída. Confira os dados e o vínculo atual da conta.',
    );
    process.exitCode = 1;
  });
}
