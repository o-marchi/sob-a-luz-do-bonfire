import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  month!: string;

  @IsString()
  @IsNotEmpty()
  year!: string;

  @IsBoolean()
  @IsOptional()
  current?: boolean;
}
