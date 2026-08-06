import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { IsTrailerPageUrl } from '../trailer-url';

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  cover?: string;

  @IsBoolean()
  @IsOptional()
  suggestion?: boolean;

  @IsString()
  @IsOptional()
  steam?: string;

  @IsString()
  @IsOptional()
  @IsTrailerPageUrl()
  trailer?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  howLongToBeatUrl?: string;

  @IsString()
  @IsOptional()
  durationLabel?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  mainHours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  mainExtraHours?: number;

  @IsString()
  @IsOptional()
  howLongToBeatTitle?: string;
}
