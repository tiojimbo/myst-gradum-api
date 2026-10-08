import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AI_THROTTLE } from '../../common/constants/app.constants';
import { AuthPrincipal } from '../auth/types/auth-principal.type';
@Injectable()
export class AiThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.handleRequest(
      context,
      AI_THROTTLE.limit,
      AI_THROTTLE.ttl,
      AI_THROTTLE,
      (request) => this.getTracker(request),
      (ctx, tracker, name) => this.generateKey(ctx, tracker, name),
    );
  }
  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    const principal = request.user as AuthPrincipal;
    return `ai:${principal.organizationId}:${principal.userId}`;
  }
}
