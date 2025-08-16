import { Injectable } from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { DeleteResult, Repository } from 'typeorm';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
  ) {}

  async create(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    const entity: Campaign = this.campaignRepository.create(createCampaignDto);
    return this.campaignRepository.save(entity);
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignRepository.find();
  }

  findOne(id: number): Promise<Campaign | null> {
    return this.campaignRepository.findOneBy({ id });
  }

  update(id: number, updateCampaignDto: UpdateCampaignDto) {
    return `This action updates a #${id} campaign`;
  }

  remove(id: number): Promise<DeleteResult> {
    return this.campaignRepository.delete(id);
  }
}
