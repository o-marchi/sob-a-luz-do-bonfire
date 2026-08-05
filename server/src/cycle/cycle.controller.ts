import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { BonfireAdminGuard } from '../auth/guards/bonfire-admin.guard';
import { Player } from '../players/entities/player.entity';
import { CycleService } from './cycle.service';
import {
  ApplyCycleTransitionDto,
  PreviewCycleTransitionDto,
  StartElectionDto,
} from './dto/cycle-transition.dto';

@ApiTags('cycle')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), BonfireAdminGuard)
@Controller('cycle')
export class CycleController {
  constructor(private readonly cycleService: CycleService) {}

  @Get('overview')
  getOverview() {
    return this.cycleService.getOverview();
  }

  @Post('draw')
  drawPool() {
    return this.cycleService.drawPool();
  }

  @Post('start-election')
  startElection(
    @Body() body: StartElectionDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.cycleService.startElection(body, player);
  }

  @Post('transition/preview')
  previewTransition(@Body() body: PreviewCycleTransitionDto) {
    return this.cycleService.previewTransition(body);
  }

  @Post('transition/apply')
  applyTransition(
    @Body() body: ApplyCycleTransitionDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.cycleService.applyTransition(body, player);
  }
}
