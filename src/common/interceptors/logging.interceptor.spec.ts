import { Logger, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';
describe('LoggingInterceptor', () => {
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
