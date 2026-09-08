process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.APP_URL = 'http://localhost:3001';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://gradum:gradum@localhost:5432/gradum_test';
process.env.DIRECT_URL = 'postgresql://gradum:gradum@localhost:5432/gradum_test';
process.env.JWT_ACCESS_SECRET =
  '9103a35f89db1c517148ff60e7ac61594af347984f4ad0d3880baa9c221e5517';
process.env.JWT_REFRESH_SECRET =
  '7477707249144c52b017abc1e8d61e6a7b2217d164bfae1d7530b82738ddb3ea';
process.env.JWT_ACCESS_EXPIRATION = '15m';
process.env.JWT_REFRESH_EXPIRATION = '7d';
process.env.BCRYPT_ROUNDS = '12';
