import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { IsInt, IsString } from 'class-validator';
import { VALIDATION_PIPE_OPTIONS } from '../constants/app.constants';

class FixtureDto {
  @IsString()
  name!: string;

  @IsInt()
  age!: number;
}

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: FixtureDto,
  data: '',
};

async function rejectionMessages(payload: unknown): Promise<string[]> {
  const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

  try {
    await pipe.transform(payload, metadata);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      message: string[];
    };
    return response.message;
  }

  throw new Error('O pipe aceitou um corpo que deveria ser rejeitado');
}

describe('ValidationPipe com VALIDATION_PIPE_OPTIONS', () => {
  it('aceita corpo que contem apenas os campos do DTO', async () => {
    const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

    await expect(
      pipe.transform({ name: 'Samuel', age: 34 }, metadata),
    ).resolves.toEqual({ name: 'Samuel', age: 34 });
  });

  it('rejeita campo fora do DTO com 400 nomeando o campo extra', async () => {
    const messages = await rejectionMessages({
      name: 'Samuel',
      age: 34,
      role: 'ADMIN',
    });

    expect(messages).toContain('property role should not exist');
  });

  it('rejeita campo de tipo errado com 400 nomeando o campo', async () => {
    const messages = await rejectionMessages({ name: 'Samuel', age: 'trinta' });

    expect(messages).toContain('age must be an integer number');
  });

  it('rejeita campo do DTO faltando com 400 nomeando o campo', async () => {
    const messages = await rejectionMessages({ name: 'Samuel' });

    expect(messages).toContain('age must be an integer number');
  });

  it('converte string em number por enableImplicitConversion', async () => {
    const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

    const result = await pipe.transform(
      { name: 'Samuel', age: '42' },
      metadata,
    );

    expect(result).toEqual({ name: 'Samuel', age: 42 });
    expect(typeof (result as FixtureDto).age).toBe('number');
  });

  it('usa a mesma constante que o main.ts registra', () => {
    expect(VALIDATION_PIPE_OPTIONS).toEqual({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });
  });
});
