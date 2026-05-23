import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AttachPoolToCampaignDto,
  BulkCampaignParticipantsDto,
  CampaignQueryDto,
  CreatePoolFromGamesDto,
  FinalizeElectionDto,
  UpdateCampaignAdminDto,
  UpsertGamesDto,
} from './dto/admin-operations.dto';
import { ApplyMonthlyPlanDto, MonthlyPlanDto } from './dto/monthly-plan.dto';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { AdminService } from './admin.service';

@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('state')
  getState() {
    return this.adminService.getState();
  }

  @Get('games')
  listGames(@Query() query: CampaignQueryDto) {
    return this.adminService.listGames(query.query);
  }

  @Get('players')
  listPlayers(@Query() query: CampaignQueryDto) {
    return this.adminService.listPlayers(query.query);
  }

  @Post('monthly-plan/preview')
  previewMonthlyPlan(@Body() body: MonthlyPlanDto) {
    return this.adminService.previewMonthlyPlan(body);
  }

  @Post('monthly-plan/apply')
  applyMonthlyPlan(@Body() body: ApplyMonthlyPlanDto) {
    return this.adminService.applyMonthlyPlan(body);
  }

  @Post('games/upsert-many')
  upsertGames(@Body() body: UpsertGamesDto) {
    return this.adminService.upsertGames(body);
  }

  @Post('pools/from-games')
  createPoolFromGames(@Body() body: CreatePoolFromGamesDto) {
    return this.adminService.createPoolFromGames(body);
  }

  @Post('pools/attach-to-campaign')
  attachPoolToCampaign(@Body() body: AttachPoolToCampaignDto) {
    return this.adminService.attachPoolToCampaign(body);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @Param('id') id: string,
    @Body() body: UpdateCampaignAdminDto,
  ) {
    return this.adminService.updateCampaign(this.parseCampaignId(id), body);
  }

  @Post('campaigns/:id/participants/bulk')
  bulkUpdateCampaignParticipants(
    @Param('id') id: string,
    @Body() body: BulkCampaignParticipantsDto,
  ) {
    return this.adminService.bulkUpdateCampaignParticipants(
      this.parseCampaignId(id),
      body,
    );
  }

  @Get('campaigns/:id/election-result')
  getElectionResult(@Param('id') id: string) {
    return this.adminService.getElectionResult(this.parseCampaignId(id));
  }

  @Post('campaigns/:id/finalize-election')
  finalizeElection(@Param('id') id: string, @Body() body: FinalizeElectionDto) {
    return this.adminService.finalizeElection(this.parseCampaignId(id), body);
  }

  private parseCampaignId(id: string): number | 'current' {
    if (id === 'current') {
      return 'current';
    }

    const campaignId = Number(id);

    if (!Number.isInteger(campaignId) || campaignId < 1) {
      throw new BadRequestException(
        'Campaign id must be a positive integer or current',
      );
    }

    return campaignId;
  }
}
