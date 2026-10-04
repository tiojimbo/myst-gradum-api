import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';

async function readPassword(): Promise<string> {
  if (!stdin.isTTY) throw new Error('Use um terminal interativo');
  stdin.setRawMode(true);
  stdout.write('Senha: ');
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let password = '';
    function finish() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
    }
    function onData(value: string) {
      for (const character of value) {
        if (character === '\u0003') {
          finish();
          reject(new Error('Cancelado'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          resolve(password);
          return;
        }
        if (character === '\u007f') password = password.slice(0, -1);
        else if (character >= ' ') password += character;
      }
    }
    stdin.on('data', onData);
  });
}

export async function createUser(): Promise<void> {
  const logger = new Logger('UserCreate');
  if (!stdin.isTTY || process.argv.length > 2)
    throw new Error('Execute sem argumentos em um terminal interativo');
  const prompt = createInterface({ input: stdin, output: stdout });
  let organizationSlug: string;
  let email: string;
  let name: string;
  try {
    organizationSlug = await prompt.question('Identificador da organização: ');
    email = await prompt.question('E-mail: ');
    name = await prompt.question('Nome: ');
  } finally {
    prompt.close();
  }
  const password = await readPassword();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    await app.get(UsersService).createUser({ organizationSlug, email, name, password });
    Logger.overrideLogger(new ConsoleLogger());
    logger.log('Usuário criado');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  void createUser().catch(() => {
    Logger.overrideLogger(new ConsoleLogger());
    new Logger('UserCreate').error('Usuário não criado. Confira os dados informados.');
    process.exitCode = 1;
  });
}
