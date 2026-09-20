import { AuthService } from './auth.service';
import { SessionsRepository } from './sessions.repository';
import { UsersRepository } from '../users/users.repository';
import { JwtService } from '@nestjs/jwt';
describe('AuthService persistência', () => {
  it.each(['logout', 'logoutAll'] as const)(
    'não informa sucesso de %s quando banco falha',
    async (method) => {
      const sessions = {
        revokeCurrent: jest.fn().mockRejectedValue(new Error('database')),
        revokeAll: jest.fn().mockRejectedValue(new Error('database')),
      };
      const service = new AuthService(
        {} as UsersRepository,
        sessions as unknown as SessionsRepository,
        {} as JwtService,
      );
      await expect(service[method]()).rejects.toThrow('database');
    },
  );
});
