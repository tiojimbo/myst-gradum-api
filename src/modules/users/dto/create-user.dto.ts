import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(80) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  organizationSlug!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
