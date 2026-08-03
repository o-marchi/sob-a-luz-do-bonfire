import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, type TransformFnParams } from 'class-transformer';

const useLegacyId = (
  value: unknown,
  object: unknown,
  legacyKey: string,
): unknown => {
  if (value !== undefined && value !== null) {
    return value;
  }

  if (typeof object !== 'object' || object === null) {
    return value;
  }

  return (object as Record<string, unknown>)[legacyKey];
};

const transformLegacyId =
  (legacyKey: string) =>
  ({ value, obj }: TransformFnParams): unknown =>
    useLegacyId(value, obj, legacyKey);

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

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsInt()
  @Transform(transformLegacyId('game_id'), { toClassOnly: true })
  @Min(1)
  gameId?: number;

  @IsBoolean()
  @IsOptional()
  electionActive?: boolean;

  @IsOptional()
  @IsInt()
  @Transform(transformLegacyId('pool_id'), { toClassOnly: true })
  @Min(1)
  poolId?: number;
}
