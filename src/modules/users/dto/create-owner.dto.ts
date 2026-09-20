import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
export class CreateOwnerDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
