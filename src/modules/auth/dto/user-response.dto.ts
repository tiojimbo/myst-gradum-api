import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';
export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) onboardingCompletedAt!: Date | null;
  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingCompletedAt: user.onboardingCompletedAt,
    };
  }
}
