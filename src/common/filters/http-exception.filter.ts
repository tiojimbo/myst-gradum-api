import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiError,
  ApiErrorDetail,
} from '../interfaces/api-response.interface';

interface ExceptionPayload {
  message?: string | string[];
  error?: string;
  details?: ApiErrorDetail[];
}

const GENERIC_MESSAGE = 'Erro interno do servidor';
const VALIDATION_MESSAGE = 'Validation failed';
const EXTRA_PROPERTY_MESSAGE = /^property (\S+) should not exist$/;

function statusText(statusCode: number): string {
  const name: string | undefined = HttpStatus[statusCode];

  if (name === undefined) {
    return 'Internal Server Error';
  }

  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function toPayload(exception: unknown): ExceptionPayload {
  if (!(exception instanceof HttpException)) {
    return {};
  }

  const response = exception.getResponse();

  if (typeof response === 'string') {
    return { message: response };
  }

  return response as ExceptionPayload;
}

function toDetail(message: string): ApiErrorDetail {
  const extraProperty = EXTRA_PROPERTY_MESSAGE.exec(message);

  if (extraProperty !== null) {
    return { field: extraProperty[1], message };
  }

  return { field: message.split(' ')[0], message };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = toPayload(exception);
    const rawMessage = payload.message;
    const messages = Array.isArray(rawMessage) ? rawMessage : null;
    const details = messages !== null ? messages.map(toDetail) : payload.details;

    let message = GENERIC_MESSAGE;
    if (messages !== null) {
      message = VALIDATION_MESSAGE;
    } else if (typeof rawMessage === 'string' && rawMessage.length > 0) {
      message = rawMessage;
    }

    const body: ApiError = {
      statusCode,
      message,
      error: payload.error ?? statusText(statusCode),
      ...(details !== undefined && details.length > 0 && { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} -> ${statusCode}: ${body.message}`,
      );
    }

    response.status(statusCode).json(body);
  }
}
