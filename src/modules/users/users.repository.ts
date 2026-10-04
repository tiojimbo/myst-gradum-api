import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  findForLogin(email: string) {
    return this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null, organization: { deletedAt: null } },
    });
  }
  createOrganization(data: { name: string; slug: string }) {
    return this.prisma.organization.create({ data });
  }
  createUser(data: {
    organizationSlug: string;
    name: string;
    email: string;
    hashedPassword: string;
  }) {
    return this.prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.findFirst({
          where: { slug: data.organizationSlug, deletedAt: null },
        });
        if (!organization) throw new NotFoundException('Organização não encontrada');
        return tx.user.create({
          data: {
            organizationId: organization.id,
            name: data.name,
            email: data.email,
            hashedPassword: data.hashedPassword,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
