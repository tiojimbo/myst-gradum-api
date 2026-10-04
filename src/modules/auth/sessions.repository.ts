import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OwnerScopeService } from '../../database/owner-scope.service';
@Injectable()
export class SessionsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OwnerScopeService,
  ) {}
  createForLogin(userId: string) {
    return this.prisma.authSession.create({ data: { userId } });
  }
  async authenticate(id: string, userId: string) {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id,
        userId,
        revokedAt: null,
        deletedAt: null,
        user: { isActive: true, deletedAt: null, organization: { deletedAt: null } },
      },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Credencial inválida');
    return session;
  }
  async currentUser() {
    const { userId, organizationId } = this.scope.principal();
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        isActive: true,
        deletedAt: null,
        organization: { deletedAt: null },
      },
    });
    if (!user) throw new UnauthorizedException('Credencial inválida');
    return user;
  }
  async revokeCurrent(): Promise<void> {
    const principal = this.scope.principal();
    if (principal.credentialType !== 'jwt') throw new UnauthorizedException();
    await this.prisma.authSession.updateMany({
      where: { ...this.scope.where(), id: principal.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async revokeAll(): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { ...this.scope.where(), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
