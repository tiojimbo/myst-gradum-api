import { registerAs } from '@nestjs/config';
import { getEnv } from './env.config';

export default registerAs('app', () => {
  const env = getEnv();

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    url: env.APP_URL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  };
});
