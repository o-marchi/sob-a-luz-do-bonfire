import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Length, Min } from 'class-validator';

export class SearchGamesQueryDto {
  @IsString()
  @Length(2, 80)
  query!: string;
}

export class AssessGameRecommendationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  steamAppId!: number;
}

export class CreateGameRecommendationDto {
  @IsString()
  @IsNotEmpty()
  assessmentToken!: string;
}
