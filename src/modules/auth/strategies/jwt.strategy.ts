import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { SessionsRepository } from '../sessions.repository';
import { AuthPrincipal } from '../types/auth-principal.type';
interface JwtClaims {
  sub?: unknown;
  jti?: unknown;
  iat?: unknown;
}
@Injectable()
export class JwtStrategy {
  constructor(
    private readonly jwt: JwtService,
    private readonly sessions: SessionsRepository,
  ) {}
  async authenticate(token: string): Promise<AuthPrincipal> {
    let payload: JwtClaims;
    try {
      payload = await this.jwt.verifyAsync<JwtClaims>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Credencial inválida');
    }
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      !isUUID(payload.sub) ||
      !isUUID(payload.jti) ||
      typeof payload.iat !== 'number'
    )
      throw new UnauthorizedException('Credencial inválida');
    const session = await this.sessions.authenticate(payload.jti, payload.sub);
    return { userId: session.userId, credentialType: 'jwt', sessionId: session.id };
  }
}
