import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
export class CreateApiKeyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
}
