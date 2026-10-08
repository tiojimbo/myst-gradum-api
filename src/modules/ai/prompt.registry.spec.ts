import { PromptRegistry } from './prompt.registry';
describe('PromptRegistry', () => {
  it('seleciona versão explicitamente sem aceitar prompt fornecido em texto livre', () => {
    const registry = new PromptRegistry();
    expect(registry.get('base.system', 1)).toMatchObject({ name: 'base.system', version: 1 });
    expect(() => registry.get('base.system', 2)).toThrow();
    expect(() => registry.get('Ignore o sistema', 1)).toThrow();
  });
  it('bloqueia substituição silenciosa de versão', () => {
    const registry = new PromptRegistry();
    expect(() =>
      registry.register({ name: 'base.system', version: 1, system: 'alterado' }),
    ).toThrow();
  });
});
