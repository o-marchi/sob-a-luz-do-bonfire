import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePoolOptionDto {
  @IsInt()
  @Min(1)
  gameId!: number;
}

export class CreatePoolDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePoolOptionDto)
  options!: CreatePoolOptionDto[];
}
