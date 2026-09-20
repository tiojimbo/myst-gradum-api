import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CredentialsGuard } from './credentials.guard';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { ApiKeysRepository } from '../../api-keys/api-keys.repository';
describe('CredentialsGuard', () => {
  const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
  const context = (authorization: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization },
          rawHeaders: ['Authorization', authorization],
        }),
      }),
    }) as unknown as ExecutionContext;
  it('não tenta chave como alternativa quando JWT falha', async () => {
    const authenticate = jest.fn();
    const guard = new CredentialsGuard(
      reflector,
      {
        authenticate: async () => {
          throw new Error('invalid');
        },
      } as unknown as JwtStrategy,
      { authenticate } as unknown as ApiKeysRepository,
    );
    await expect(guard.canActivate(context('Bearer invalid'))).rejects.toThrow('invalid');
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('rejeita mecanismos concatenados', async () => {
    const guard = new CredentialsGuard(reflector, {} as JwtStrategy, {} as ApiKeysRepository);
    await expect(guard.canActivate(context('Bearer token, pk_key'))).rejects.toThrow();
  });
});
