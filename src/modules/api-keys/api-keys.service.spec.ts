import { createHash } from 'node:crypto';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysRepository } from './api-keys.repository';
describe('ApiKeysService', () => {
  it('persiste hash e devolve segredo somente na criação', async () => {
    const create = jest.fn().mockImplementation(async (input) => ({
      ...input,
      id: 'key',
      createdAt: new Date(),
      revokedAt: null,
    }));
    const result = await new ApiKeysService({ create } as unknown as ApiKeysRepository).create({
      name: 'Integração',
    });
    expect(create).toHaveBeenCalledWith({
      name: 'Integração',
      keyHash: createHash('sha256').update(result.key).digest('hex'),
      keySuffix: result.key.slice(-8),
    });
    expect(result.apiKey).not.toHaveProperty('keyHash');
  });
});
