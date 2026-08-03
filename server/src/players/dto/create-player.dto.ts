import { IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DiscordProfileDto {
  @IsOptional()
  @IsString()
  id?: string | null;

  @IsOptional()
  @IsString()
  username?: string | null;

  @IsOptional()
  @IsString()
  global_name?: string | null;

  @IsOptional()
  @IsString()
  globalName?: string | null;

  @IsOptional()
  @IsString()
  avatar?: string | null;
}

export class CreatePlayerDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordProfileDto)
  discord?: DiscordProfileDto;
}
