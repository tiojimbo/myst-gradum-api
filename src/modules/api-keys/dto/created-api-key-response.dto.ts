import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyResponseDto } from './api-key-response.dto';
export class CreatedApiKeyResponseDto {
  @ApiProperty({ type: ApiKeyResponseDto }) apiKey!: ApiKeyResponseDto;
  @ApiProperty() key!: string;
}
