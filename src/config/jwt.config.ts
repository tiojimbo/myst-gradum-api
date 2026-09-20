import { registerAs } from '@nestjs/config';
import { getEnv } from './env.config';

export default registerAs('jwt', () => {
  const env = getEnv();

  return {
    accessSecret: env.JWT_ACCESS_SECRET,
  };
});
