import { ApiProperty } from '@nestjs/swagger';
import { ApiKey } from '@prisma/client';
export class ApiKeyResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() keySuffix!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ nullable: true }) revokedAt!: Date | null;
  static fromEntity(key: ApiKey): ApiKeyResponseDto {
    return {
      id: key.id,
      name: key.name,
      keySuffix: key.keySuffix,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    };
  }
}
