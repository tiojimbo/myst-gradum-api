import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { BusinessException, DuplicateResourceException } from '../exceptions/business.exception';
import { ApiError } from '../interfaces/api-response.interface';
import { AllExceptionsFilter } from './http-exception.filter';

interface Captured {
  status: number;
  body: ApiError;
}

function run(exception: unknown, url = '/api/v1/exemplo'): Captured {
  const captured: Partial<Captured> = {};

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (statusCode: number) => ({
          json: (body: ApiError) => {
            captured.status = statusCode;
            captured.body = body;
          },
        }),
      }),
      getRequest: () => ({ url, method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return captured as Captured;
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('traduz NotFoundException para o formato do 8.4 com path', () => {
    const { status, body } = run(
      new NotFoundException('Cannot GET /api/v1/nao-existe'),
      '/api/v1/nao-existe',
    );

    expect(status).toBe(404);
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Rota não encontrada');
    expect(body.path).toBe('/api/v1/nao-existe');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('traduz BusinessException para 422 com details', () => {
    const { status, body } = run(
      new BusinessException('Fase anterior nao concluida', [
        { field: 'phaseId', message: 'Fase anterior nao concluida' },
      ]),
    );

    expect(status).toBe(422);
    expect(body.error).toBe('Unprocessable Entity');
    expect(body.details).toEqual([{ field: 'phaseId', message: 'Fase anterior nao concluida' }]);
  });

  it('traduz DuplicateResourceException para 409', () => {
    const { status, body } = run(new DuplicateResourceException('Projeto', 'slug', 'algebra'));

    expect(status).toBe(409);
    expect(body.error).toBe('Conflict');
  });

  it('preenche details com { field, message } em erro de validacao', () => {
    const { status, body } = run(
      new BadRequestException(['email must be an email', 'property extra should not exist']),
    );

    expect(status).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(body.details).toEqual([
      { field: 'email', message: 'email must be an email' },
      { field: 'extra', message: 'property extra should not exist' },
    ]);
  });

  it('transforma Error cru em 500 sem vazar mensagem nem stack', () => {
    const { status, body } = run(new Error('boom'));

    expect(status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('Erro interno do servidor');
    expect(JSON.stringify(body)).not.toContain('boom');
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('loga error em >= 500 e warn abaixo', () => {
    const error = jest.spyOn(Logger.prototype, 'error');
    const warn = jest.spyOn(Logger.prototype, 'warn');

    run(new Error('boom'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    error.mockClear();
    run(new NotFoundException());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('traduz ThrottlerException para 429 no formato do 8.4', () => {
    const { status, body } = run(new ThrottlerException());

    expect(status).toBe(429);
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(body.path).toBe('/api/v1/exemplo');
  });

  it('nao embrulha o corpo de erro em { data, meta }', () => {
    const { body } = run(new NotFoundException());

    expect('data' in body).toBe(false);
    expect('meta' in body).toBe(false);
  });
  it('preserva mensagem específica de recurso inexistente', () => {
    const { body } = run(
      new NotFoundException('Chave não encontrada'),
      '/api/v1/api-keys/id/revoke',
    );
    expect(body.message).toBe('Chave não encontrada');
  });
});
