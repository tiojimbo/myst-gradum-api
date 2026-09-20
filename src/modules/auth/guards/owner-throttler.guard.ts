import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthPrincipal } from '../types/auth-principal.type';
@Injectable()
export class OwnerThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.handleRequest(
      context,
      5,
      60000,
      { name: 'owner-keys', limit: 5, ttl: 60000 },
      (request) => this.getTracker(request),
      (ctx, tracker, name) => this.generateKey(ctx, tracker, name),
    );
  }
  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const principal = request.user as AuthPrincipal | undefined;
    return principal ? `owner:${principal.userId}` : String(request.ip);
  }
}
