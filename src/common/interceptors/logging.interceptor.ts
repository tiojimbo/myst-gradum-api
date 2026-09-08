import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'creditCard',
];

export function sanitizeForLogging(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = { ...data };

  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

function toLoggableBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;

  return Object.keys(record).length > 0 ? sanitizeForLogging(record) : null;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, url } = request;
    const startedAt = Date.now();

    const body = toLoggableBody(request.body);
    if (body !== null) {
      this.logger.debug(`${method} ${url} body ${JSON.stringify(body)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = http.getResponse<Response>();
          this.logger.log(
            `${method} ${url} ${statusCode} - ${Date.now() - startedAt}ms`,
          );
        },
        error: () => {
          this.logger.log(`${method} ${url} - ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
