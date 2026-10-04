import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
@Injectable({ scope: Scope.REQUEST })
export class OwnerScopeService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}
  where(): {
    userId: string;
    user: { organizationId: string; organization: { deletedAt: null } };
    deletedAt: null;
  } {
    const { userId, organizationId } = this.principal();
    return { userId, user: { organizationId, organization: { deletedAt: null } }, deletedAt: null };
  }
  personalWhere(): { organizationId: string; userId: string; deletedAt: null } {
    const { organizationId, userId } = this.principal();
    return { organizationId, userId, deletedAt: null };
  }
  principal() {
    const principal = this.request.user;
    if (!principal?.userId || !principal.organizationId) throw new UnauthorizedException();
    return principal;
  }
}
