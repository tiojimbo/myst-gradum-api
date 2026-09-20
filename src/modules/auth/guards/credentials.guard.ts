import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { API_KEY_ONLY } from '../../../common/decorators/api-key-only.decorator';
import { ApiKeysRepository } from '../../api-keys/api-keys.repository';
import { JwtStrategy } from '../strategies/jwt.strategy';
@Injectable()
export class CredentialsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtStrategy,
    private readonly keys: ApiKeysRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const count = request.rawHeaders.filter(
      (name, index) => index % 2 === 0 && name.toLowerCase() === 'authorization',
    ).length;
    if (count > 1 || typeof authorization !== 'string' || !/^Bearer [^\s,]+$/.test(authorization))
      throw new UnauthorizedException('Credencial inválida');
    const token = authorization.slice(7);
    const principal = token.startsWith('pk_')
      ? await this.keys.authenticate(token)
      : await this.jwt.authenticate(token);
    const keyOnly = this.reflector.getAllAndOverride<boolean>(API_KEY_ONLY, targets) ?? false;
    if (keyOnly !== (principal.credentialType === 'api-key'))
      throw new ForbiddenException('Sem permissão');
    request.user = principal;
    return true;
  }
}
