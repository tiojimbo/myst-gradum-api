import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { hash } from 'bcrypt';
import { UsersRepository } from './users.repository';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { AssociateLegacyOwnerDto } from './dto/associate-legacy-owner.dto';
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  async createOwner(input: CreateOwnerDto) {
    const dto = plainToInstance(CreateOwnerDto, input);
    if (
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length ||
      Buffer.byteLength(dto.password ?? '') > 72
    ) {
      throw new BadRequestException('Dados do proprietário inválidos');
    }
    return this.repository.createOwner({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      hashedPassword: await hash(dto.password, 12),
    });
  }
  async associateLegacyOwner(input: AssociateLegacyOwnerDto) {
    const dto = plainToInstance(AssociateLegacyOwnerDto, input);
    dto.name = dto.name?.trim();
    dto.slug = dto.slug?.trim().toLowerCase();
    if ((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length)
      throw new BadRequestException('Dados da organização inválidos');
    return this.repository.associateLegacyOwner({ name: dto.name, slug: dto.slug });
  }
}
