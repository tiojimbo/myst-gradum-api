import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  findForLogin(email: string) {
    return this.prisma.user.findFirst({
      where: { email, singletonKey: 1, isActive: true, deletedAt: null },
    });
  }
  createOwner(data: { name: string; email: string; hashedPassword: string }) {
    return this.prisma.user.create({ data: { ...data, singletonKey: 1 } });
  }
}
