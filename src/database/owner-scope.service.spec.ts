import { Request } from 'express';
import { OwnerScopeService } from './owner-scope.service';
describe('OwnerScopeService', () => {
  it('nega consulta sem contexto', () => {
    expect(() => new OwnerScopeService({} as Request).where()).toThrow();
  });
  it('nega contexto com pessoa mas sem organização', () => {
    const scope = new OwnerScopeService({
      user: { userId: 'a', credentialType: 'jwt', sessionId: '1' },
    } as unknown as Request);
    expect(() => scope.where()).toThrow();
  });
  it('isola requisições simultâneas por identidade autenticada', () => {
    const a = new OwnerScopeService({
      user: { userId: 'a', organizationId: 'org-a', credentialType: 'jwt', sessionId: '1' },
    } as unknown as Request);
    const b = new OwnerScopeService({
      user: { userId: 'b', organizationId: 'org-b', credentialType: 'api-key', apiKeyId: '2' },
    } as unknown as Request);
    expect(a.where()).toEqual({
      userId: 'a',
      user: { organizationId: 'org-a', organization: { deletedAt: null } },
      deletedAt: null,
    });
    expect(b.where()).toEqual({
      userId: 'b',
      user: { organizationId: 'org-b', organization: { deletedAt: null } },
      deletedAt: null,
    });
    expect(a.personalWhere()).toEqual({ organizationId: 'org-a', userId: 'a', deletedAt: null });
    expect(a.where().userId).toBe('a');
  });
});
