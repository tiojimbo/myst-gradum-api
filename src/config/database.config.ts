import { registerAs } from '@nestjs/config';
import { getEnv } from './env.config';

export default registerAs('database', () => {
  const env = getEnv();

  return {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  };
});
