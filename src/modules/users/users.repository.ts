import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  associateLegacyOwner(data: { name: string; slug: string }) {
    return this.prisma.$transaction(
      async (tx) => {
        const users = await tx.user.findMany({ take: 2 });
        if (users.length !== 1 || users[0].organizationId !== null)
          throw new ConflictException('Conta existente não está apta para associação');
        const organization = await tx.organization.create({ data });
        const updated = await tx.user.updateMany({
          where: { id: users[0].id, organizationId: null },
          data: { organizationId: organization.id },
        });
        if (updated.count !== 1)
          throw new ConflictException('Conta existente não está apta para associação');
        return organization;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
