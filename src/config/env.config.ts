import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_REFRESH_SECRET: z.string().min(64),
  JWT_ACCESS_EXPIRATION: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().min(1).default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(12).default(12),
});

export type Env = z.infer<typeof envSchema>;

const logger = new Logger('EnvConfig');

let validatedEnv: Env | undefined;

export function validate(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    logger.error('Variaveis de ambiente invalidas: a aplicacao nao vai subir.');
    for (const issue of parsed.error.issues) {
      logger.error(`${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  validatedEnv = parsed.data;

  return parsed.data;
}

export function getEnv(): Env {
  return validatedEnv ?? validate(process.env);
}
