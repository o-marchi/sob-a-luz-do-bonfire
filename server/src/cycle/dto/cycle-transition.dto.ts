import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StartElectionDto {
  @IsString()
  @IsNotEmpty()
  selectionToken!: string;

  @IsOptional()
  @IsISO8601()
  electionEndsAt?: string;
}

export class CancelElectionDto {
  @IsBoolean()
  confirm!: boolean;
}

export class DiscordTransitionDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  oldChannelId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  discussionCategoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  historyCategoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  voiceChannelId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  newChannelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  newChannelTopic?: string;
}

export class PreviewCycleTransitionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  winnerGameId?: number;

  @IsString()
  @IsNotEmpty()
  month!: string;

  @IsString()
  @IsNotEmpty()
  year!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsISO8601()
  meetingAt?: string;

  @IsOptional()
  @IsString()
  meetingLocation?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscordTransitionDto)
  discord?: DiscordTransitionDto;

  @IsOptional()
  @IsBoolean()
  allowEarlyClose?: boolean;
}

export class ApplyCycleTransitionDto extends PreviewCycleTransitionDto {
  @IsBoolean()
  confirm!: boolean;

  @IsString()
  @IsNotEmpty()
  confirmationToken!: string;
}
