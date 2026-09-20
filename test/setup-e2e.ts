import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.APP_URL = 'http://localhost:3001';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.DATABASE_URL =
  'postgresql://gradum_test:gradum_test_local@127.0.0.1:55443/gradum_auth_test';
process.env.DATABASE_URL += `?schema=auth_test_${randomUUID().replaceAll('-', '')}`;
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(128);
process.env.BCRYPT_ROUNDS = '12';
