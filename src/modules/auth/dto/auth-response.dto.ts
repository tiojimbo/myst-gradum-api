import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';
export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
  @ApiProperty() accessToken!: string;
}
