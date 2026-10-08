import { HttpException, HttpStatus } from '@nestjs/common';
export class AiDisabledException extends HttpException {
  constructor() {
    super(
      { message: 'Inteligência artificial desligada', error: 'AI_DISABLED' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
export class AiUnavailableException extends HttpException {
  constructor() {
    super(
      { message: 'Inteligência artificial indisponível', error: 'AI_UNAVAILABLE' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
export class AiInvalidOutputException extends HttpException {
  constructor() {
    super(
      { message: 'Resposta da inteligência artificial inválida', error: 'AI_INVALID_OUTPUT' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
