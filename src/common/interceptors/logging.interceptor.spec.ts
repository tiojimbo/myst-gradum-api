import { Logger, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor, sanitizeForLogging } from './logging.interceptor';
describe('LoggingInterceptor', () => {
  it('remove chave OpenRouter e conteúdo de mensagens aninhadas sem alterar o original', () => {
    const data = {
      OPENROUTER_API_KEY: 'chave-privada',
      nested: { messages: [{ content: 'nota-privada' }] },
      promptName: 'base.system',
      size: 12,
    };
    const sanitized = sanitizeForLogging(data);
    expect(JSON.stringify(sanitized)).not.toContain('chave-privada');
    expect(JSON.stringify(sanitized)).not.toContain('nota-privada');
    expect(sanitized).toMatchObject({ promptName: 'base.system', size: 12 });
    expect(data.OPENROUTER_API_KEY).toBe('chave-privada');
  });
  it('não registra corpo, query ou autorização', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/api/v1/auth/login',
          url: '/api/v1/auth/login?token=secret',
          body: { password: 'secret' },
          headers: { authorization: 'secret' },
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    new LoggingInterceptor()
      .intercept(context, { handle: () => of({ accessToken: 'secret' }) })
      .subscribe();
    expect(JSON.stringify([log.mock.calls, debug.mock.calls])).not.toContain('secret');
    log.mockRestore();
    debug.mockRestore();
  });
});
