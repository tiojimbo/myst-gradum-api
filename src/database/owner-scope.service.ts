import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
@Injectable({ scope: Scope.REQUEST })
export class OwnerScopeService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}
  where(): { userId: string; deletedAt: null } {
    if (!this.request.user) throw new UnauthorizedException();
    return { userId: this.request.user.userId, deletedAt: null };
  }
  principal() {
    this.where();
    return this.request.user!;
  }
}
