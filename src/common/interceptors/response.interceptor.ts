import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

interface PaginatedPayload {
  items: unknown[];
  meta: PaginationMeta;
}

function isPaginated(payload: unknown): payload is PaginatedPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const candidate = payload as Partial<PaginatedPayload>;

  return (
    Array.isArray(candidate.items) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  );
}

function resolveRequestId(request: Request): string {
  const header = request.headers['x-request-id'];
  const received = Array.isArray(header) ? header[0] : header;

  return received !== undefined && received.length > 0 ? received : randomUUID();
}

@Injectable()
export class ResponseInterceptor
  implements NestInterceptor<unknown, ApiResponse<unknown>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiResponse<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = resolveRequestId(request);

    return next.handle().pipe(
      map((payload) => {
        if (isPaginated(payload)) {
          return {
            data: payload.items,
            meta: {
              timestamp: new Date().toISOString(),
              requestId,
              pagination: payload.meta,
            },
          };
        }

        return {
          data: payload,
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
      }),
    );
  }
}
