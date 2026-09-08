import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

export class BusinessException extends HttpException {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(
      {
        message,
        error: 'Unprocessable Entity',
        ...(details !== undefined && { details }),
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, id: string) {
    super(
      {
        message: `${resource} com id '${id}' não encontrado`,
        error: 'Not Found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateResourceException extends HttpException {
  constructor(resource: string, field: string, value: string) {
    super(
      {
        message: `${resource} com ${field} '${value}' já existe`,
        error: 'Conflict',
      },
      HttpStatus.CONFLICT,
    );
  }
}
