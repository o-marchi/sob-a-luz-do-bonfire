import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Campaign } from './entities/campaign.entity';
import { DeleteResult } from 'typeorm';
import express from 'express';
import rawbody from 'raw-body';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { Player } from '../players/entities/player.entity';
import { UpdateGameInformationDto } from './dto/update-game-information.dto';
import { AuthGuard } from '@nestjs/passport';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('campaign')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  create(@Body() createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    return this.campaignService.create(createCampaignDto);
  }

  @Get()
  findAll(): Promise<Campaign[]> {
    return this.campaignService.findAll();
  }

  @Get('current')
  @UseGuards(OptionalJwtAuthGuard)
  current(@CurrentPlayer() player: Player | null): Promise<Campaign | null> {
    return this.campaignService.current(player);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Campaign | null> {
    return this.campaignService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    return this.campaignService.update(+id, updateCampaignDto);
  }

  @Patch('description/:id')
  async updateDescription(
    @Param('id') id: string,
    @Req() req: express.Request,
  ): Promise<Campaign | null> {
    if (!req.readable) {
      throw new Error('Request not readable');
    }

    const body: string = (await rawbody(req, {})).toString().trim();

    if (!body) {
      throw new Error('No description provided');
    }

    return this.campaignService.update(+id, { description: body });
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<DeleteResult> {
    return this.campaignService.remove(+id);
  }

  @Put('update-player-game-information')
  @UseGuards(AuthGuard('jwt'))
  async updatePlayerGameInformation(
    @Body() updateGameInformation: UpdateGameInformationDto,
    @CurrentPlayer() player: Player,
  ): Promise<Campaign> {
    await this.campaignService.updatePlayerGameInformation(
      player,
      updateGameInformation,
    );

    return this.campaignService.current();
  }
}
