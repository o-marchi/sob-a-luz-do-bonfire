import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminGameInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsBoolean()
  suggestion?: boolean;

  @IsOptional()
  @IsString()
  steam?: string;

  @IsOptional()
  @IsString()
  trailer?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  howLongToBeatUrl?: string;

  @IsOptional()
  @IsString()
  durationLabel?: string;
}

export class AdminCampaignInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsOptional()
  @IsBoolean()
  useCurrent?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  month?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  year?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  meetingAt?: string;

  @IsOptional()
  @IsString()
  meetingLocation?: string;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsBoolean()
  electionActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gameId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gameTitle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  poolId?: number;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsBoolean()
  setCurrent?: boolean;
}

export class AdminPoolInputDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  gameIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gameTitles?: string[];

  @IsOptional()
  @IsBoolean()
  attachToCampaign?: boolean;
}

export class AdminPlayerReferenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  playerId?: number;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  discordId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  discordUsername?: string;

  @IsOptional()
  @IsBoolean()
  createIfMissing?: boolean;
}

export class AdminParticipantInputDto {
  @ValidateNested()
  @Type(() => AdminPlayerReferenceDto)
  player!: AdminPlayerReferenceDto;

  @IsOptional()
  @IsBoolean()
  played_the_game?: boolean;

  @IsOptional()
  @IsBoolean()
  finished_the_game?: boolean;

  @IsOptional()
  @IsBoolean()
  partook_in_the_meeting?: boolean;

  @IsOptional()
  @IsBoolean()
  suggested_a_game?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  suggestedGameId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  suggestedGameTitle?: string;
}

export class AdminGameRecommendationInputDto {
  @ValidateNested()
  @Type(() => AdminPlayerReferenceDto)
  player!: AdminPlayerReferenceDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gameId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gameTitle?: string;
}

export class MonthlyPlanDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AdminCampaignInputDto)
  campaign?: AdminCampaignInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminGameInputDto)
  games?: AdminGameInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPoolInputDto)
  pool?: AdminPoolInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminParticipantInputDto)
  participants?: AdminParticipantInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminGameRecommendationInputDto)
  recommendations?: AdminGameRecommendationInputDto[];
}

export class ApplyMonthlyPlanDto extends MonthlyPlanDto {
  @IsBoolean()
  confirm!: boolean;

  @IsString()
  @IsNotEmpty()
  confirmationToken!: string;
}
