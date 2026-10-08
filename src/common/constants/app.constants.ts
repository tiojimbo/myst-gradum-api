import { ValidationPipeOptions } from '@nestjs/common';

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_PAGE_SIZE = 100;

export const API_PREFIX = 'api/v1';
export const AI_THROTTLE = { name: 'ai', ttl: 60000, limit: 10 };

export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
};
