import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AssociateLegacyOwnerDto {
  @IsString() @MinLength(1) @MaxLength(120) @Matches(/\S/) name!: string;
  @IsString() @MinLength(3) @MaxLength(80) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
