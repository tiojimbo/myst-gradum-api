import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { hash } from 'bcrypt';
import { UsersRepository } from './users.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUserDto } from './dto/create-user.dto';
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  async createOrganization(input: CreateOrganizationDto) {
    const dto = plainToInstance(CreateOrganizationDto, input);
    dto.name = dto.name?.trim();
    dto.slug = dto.slug?.trim().toLowerCase();
    if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
      throw new BadRequestException('Dados da organização inválidos');
    return this.repository.createOrganization({ name: dto.name, slug: dto.slug });
  }
  async createUser(input: CreateUserDto) {
    const dto = plainToInstance(CreateUserDto, input);
    dto.organizationSlug = dto.organizationSlug?.trim().toLowerCase();
    dto.name = dto.name?.trim();
    dto.email = dto.email?.trim().toLowerCase();
    if (
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length ||
      Buffer.byteLength(dto.password ?? '') > 72
    ) {
      throw new BadRequestException('Dados do usuário inválidos');
    }
    return this.repository.createUser({
      organizationSlug: dto.organizationSlug,
      name: dto.name,
      email: dto.email,
      hashedPassword: await hash(dto.password, 12),
    });
  }
}
