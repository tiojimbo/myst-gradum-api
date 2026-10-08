import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'creditCard',
  'OPENROUTER_API_KEY',
  'messages',
  'input',
  'output',
  'prompt',
  'content',
];

export function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const sensitive = new Set(SENSITIVE_FIELDS.map((field) => field.toLowerCase()));
  const seen = new WeakSet<object>();
  const sanitize = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(sanitize);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitive.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(item),
      ]),
    );
  };
  return sanitize(data) as Record<string, unknown>;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method } = request;
    const url = request.path;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = http.getResponse<Response>();
          this.logger.log(`${method} ${url} ${statusCode} - ${Date.now() - startedAt}ms`);
        },
        error: () => {
          this.logger.log(`${method} ${url} - ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
