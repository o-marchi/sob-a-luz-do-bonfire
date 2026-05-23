import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AdminCampaignInputDto,
  AdminGameInputDto,
  AdminParticipantInputDto,
  AdminPoolInputDto,
} from './monthly-plan.dto';

export class UpsertGamesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminGameInputDto)
  games!: AdminGameInputDto[];
}

export class CreatePoolFromGamesDto extends AdminPoolInputDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campaignId?: number;
}

export class AttachPoolToCampaignDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  poolId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campaignId?: number;
}

export class BulkCampaignParticipantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminParticipantInputDto)
  participants!: AdminParticipantInputDto[];
}

export class UpdateCampaignAdminDto extends AdminCampaignInputDto {}

export class CampaignQueryDto {
  @IsOptional()
  @IsString()
  query?: string;
}

export class FinalizeElectionDto {
  @IsOptional()
  @IsBoolean()
  allowTie?: boolean;
}
