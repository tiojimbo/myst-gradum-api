import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (CUID_PATTERN.test(value)) {
      return value;
    }

    const field = metadata.data ?? 'id';

    throw new BadRequestException({
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field, message: `${field} deve ser um cuid válido` }],
    });
  }
}
