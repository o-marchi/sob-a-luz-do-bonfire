import { IsString, Matches, MaxLength } from 'class-validator';
import { RULES_MAX_LENGTH } from '../../content/default-rules';

export class UpdateRulesDto {
  @IsString()
  @Matches(/\S/, { message: 'content must contain visible text' })
  @MaxLength(RULES_MAX_LENGTH)
  content!: string;
}
