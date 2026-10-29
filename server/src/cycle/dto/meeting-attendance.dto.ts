import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateMeetingAttendanceDto {
  @IsInt()
  @Min(1)
  campaignId!: number;

  @IsInt()
  @Min(1)
  playerId!: number;

  @IsBoolean()
  attended!: boolean;
}
