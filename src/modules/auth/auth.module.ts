import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionsRepository } from './sessions.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CredentialsGuard } from './guards/credentials.guard';
@Module({
  imports: [
    UsersModule,
    ApiKeysModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsRepository, JwtStrategy, CredentialsGuard],
  exports: [CredentialsGuard, JwtStrategy],
})
export class AuthModule {}
