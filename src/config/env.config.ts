import { Logger } from '@nestjs/common';
import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url(),
    CORS_ORIGINS: z.string().min(1),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(64),
    BCRYPT_ROUNDS: z.coerce.number().int().min(12).default(12),
    AI_ENABLED: z.preprocess(
      (value) => (value === 'true' ? true : value === 'false' ? false : value),
      z.boolean().default(false),
    ),
    OPENROUTER_API_KEY: z.string().trim().min(1).optional(),
    OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
    OPENROUTER_HTTP_REFERER: z.string().url().optional(),
    OPENROUTER_TITLE: z.string().trim().min(1).optional(),
    OPENROUTER_JSON_SCHEMA_MODELS: z.string().default(''),
    AI_MODEL_DEFAULT: z.string().trim().min(1).optional(),
    AI_MODEL_GOAL: z.string().trim().min(1).optional(),
    AI_MODEL_COMPETENCY: z.string().trim().min(1).optional(),
    AI_MODEL_DIAGNOSTIC: z.string().trim().min(1).optional(),
    AI_MODEL_GRADING: z.string().trim().min(1).optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1).max(60000).default(60000),
    AI_MAX_TOKENS: z.coerce.number().int().positive().default(4000),
  })
  .superRefine((value, context) => {
    if (!value.AI_ENABLED) return;
    for (const key of ['OPENROUTER_API_KEY', 'AI_MODEL_DEFAULT'] as const) {
      if (!value[key])
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Obrigatória com IA ligada',
        });
    }
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
