import { Request } from 'express';
import { OwnerScopeService } from './owner-scope.service';
describe('OwnerScopeService', () => {
  it('nega consulta sem contexto', () => {
    expect(() => new OwnerScopeService({} as Request).where()).toThrow();
  });
  it('isola requisições simultâneas por identidade autenticada', () => {
    const a = new OwnerScopeService({
      user: { userId: 'a', credentialType: 'jwt', sessionId: '1' },
    } as Request);
    const b = new OwnerScopeService({
      user: { userId: 'b', credentialType: 'api-key', apiKeyId: '2' },
    } as Request);
    expect(a.where()).toEqual({ userId: 'a', deletedAt: null });
    expect(b.where()).toEqual({ userId: 'b', deletedAt: null });
    expect(a.where().userId).toBe('a');
  });
});
