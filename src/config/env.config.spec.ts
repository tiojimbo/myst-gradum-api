import { Logger } from '@nestjs/common';
import { envSchema, validate } from './env.config';

const ACCESS_SECRET = 'a'.repeat(64);

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  APP_URL: 'http://localhost:3001',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://gradum:gradum@localhost:5432/gradum',
  DIRECT_URL: 'postgresql://gradum:gradum@localhost:5432/gradum',
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  BCRYPT_ROUNDS: '12',
};

const REQUIRED_KEYS = [
  'NODE_ENV',
  'APP_URL',
  'CORS_ORIGINS',
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_ACCESS_SECRET',
];

const KEYS_WITH_DEFAULT = ['PORT', 'BCRYPT_ROUNDS'];

function envWithout(...keys: string[]): Record<string, string> {
  const copy = { ...VALID_ENV };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

function issuePaths(raw: Record<string, unknown>): string[] {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) {
    return [];
  }
  return parsed.error.issues.map((issue) => issue.path.join('.'));
}

describe('envSchema', () => {
  it('aceita o ambiente completo', () => {
    const parsed = envSchema.safeParse(VALID_ENV);

    expect(parsed.success).toBe(true);
  });

  it('reprova o objeto vazio nomeando toda variavel obrigatoria', () => {
    const parsed = envSchema.safeParse({});

    expect(parsed.success).toBe(false);
    expect(issuePaths({}).sort()).toEqual([...REQUIRED_KEYS].sort());
  });

  it.each(REQUIRED_KEYS)('reprova %s ausente apontando o path certo', (key) => {
    const paths = issuePaths(envWithout(key));

    expect(paths).toEqual([key]);
  });

  it.each(KEYS_WITH_DEFAULT)('aceita %s ausente porque tem default', (key) => {
    expect(issuePaths(envWithout(key))).toEqual([]);
  });

  it('aplica os defaults de PORT, expiracoes e BCRYPT_ROUNDS', () => {
    const parsed = envSchema.parse(envWithout(...KEYS_WITH_DEFAULT));

    expect(parsed.PORT).toBe(3001);
    expect(parsed.BCRYPT_ROUNDS).toBe(12);
  });

  it('converte PORT e BCRYPT_ROUNDS de string para number', () => {
    const parsed = envSchema.parse({ ...VALID_ENV, PORT: '4000', BCRYPT_ROUNDS: '14' });

    expect(parsed.PORT).toBe(4000);
    expect(parsed.BCRYPT_ROUNDS).toBe(14);
  });

  it('reprova NODE_ENV fora do enum', () => {
    expect(issuePaths({ ...VALID_ENV, NODE_ENV: 'producao' })).toEqual(['NODE_ENV']);
  });

  it('reprova APP_URL, DATABASE_URL e DIRECT_URL que nao sao url', () => {
    expect(issuePaths({ ...VALID_ENV, APP_URL: 'nao-e-url' })).toEqual(['APP_URL']);
    expect(issuePaths({ ...VALID_ENV, DATABASE_URL: 'nao-e-url' })).toEqual(['DATABASE_URL']);
    expect(issuePaths({ ...VALID_ENV, DIRECT_URL: 'nao-e-url' })).toEqual(['DIRECT_URL']);
  });

  it('reprova PORT nao numerico e BCRYPT_ROUNDS abaixo de 12', () => {
    expect(issuePaths({ ...VALID_ENV, PORT: 'abc' })).toEqual(['PORT']);
    expect(issuePaths({ ...VALID_ENV, BCRYPT_ROUNDS: '10' })).toEqual(['BCRYPT_ROUNDS']);
  });

  it('reprova DATABASE_URL vazia', () => {
    expect(issuePaths({ ...VALID_ENV, DATABASE_URL: '' })).toEqual(['DATABASE_URL']);
  });

  it('reprova segredo de 63 caracteres e aceita o de 64', () => {
    const short = 'c'.repeat(63);

    expect(issuePaths({ ...VALID_ENV, JWT_ACCESS_SECRET: short })).toEqual(['JWT_ACCESS_SECRET']);
    expect(envSchema.safeParse({ ...VALID_ENV, JWT_ACCESS_SECRET: 'c'.repeat(64) }).success).toBe(
      true,
    );
  });

  it('nao repete o valor do segredo na mensagem de erro', () => {
    const short = 'c'.repeat(63);
    const parsed = envSchema.safeParse({ ...VALID_ENV, JWT_ACCESS_SECRET: short });
    const dump = parsed.success ? '' : JSON.stringify(parsed.error.issues);

    expect(dump).toContain('JWT_ACCESS_SECRET');
    expect(dump).not.toContain(short);
  });
});

describe('validate', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devolve o ambiente tipado e nao encerra o processo quando tudo e valido', () => {
    const env = validate(VALID_ENV);

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('test');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('chama process.exit(1) exatamente uma vez com ambiente vazio', () => {
    validate({});

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('loga uma linha por issue do Zod pelo Logger do Nest', () => {
    validate({});

    const logged = errorSpy.mock.calls.map((call) => String(call[0]));

    expect(errorSpy).toHaveBeenCalledTimes(REQUIRED_KEYS.length + 1);
    for (const key of REQUIRED_KEYS) {
      expect(logged.some((line) => line.startsWith(`${key}:`))).toBe(true);
    }
  });

  it('nomeia a variavel sem vazar o valor do segredo no log', () => {
    const short = 'c'.repeat(63);

    validate({ ...VALID_ENV, JWT_ACCESS_SECRET: short });

    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');

    expect(logged).toContain('JWT_ACCESS_SECRET');
    expect(logged).not.toContain(short);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
