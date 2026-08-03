import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePoolDto } from './dto/create-pool.dto';
import { UpdatePoolDto } from './dto/update-pool.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Pool } from './entities/pool.entity';
import { DataSource, DeleteResult, EntityManager, Repository } from 'typeorm';
import { PoolOption } from './entities/pool-option.entity';
import { Game } from '../games/entities/game.entity';

@Injectable()
export class PoolService {
  constructor(
    @InjectRepository(Pool)
    private poolRepository: Repository<Pool>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createPoolDto: CreatePoolDto): Promise<Pool> {
    return this.dataSource.transaction(async (manager) => {
      const pool = manager.getRepository(Pool).create();
      pool.options = await this.buildOptions(manager, createPoolDto);

      return manager.getRepository(Pool).save(pool);
    });
  }

  findAll(): Promise<Pool[]> {
    return this.poolRepository.find({
      relations: ['options', 'options.game', 'options.players'],
    });
  }

  findOne(id: number): Promise<Pool | null> {
    return this.poolRepository.findOne({
      where: { id },
      relations: ['options', 'options.game', 'options.players'],
    });
  }

  async update(id: number, updatePoolDto: UpdatePoolDto): Promise<Pool> {
    return this.dataSource.transaction(async (manager) => {
      const poolRepository = manager.getRepository(Pool);
      const pool = await poolRepository.findOne({
        where: { id },
        relations: ['options', 'options.game', 'options.players'],
      });

      if (!pool) {
        throw new NotFoundException(`Pool #${id} not found`);
      }

      if (updatePoolDto.options) {
        await manager.getRepository(PoolOption).remove(pool.options);
        pool.options = await this.buildOptions(manager, {
          options: updatePoolDto.options,
        });
        await poolRepository.save(pool);
      }

      return poolRepository.findOneOrFail({
        where: { id },
        relations: ['options', 'options.game', 'options.players'],
      });
    });
  }

  remove(id: number): Promise<DeleteResult> {
    return this.poolRepository.delete(id);
  }

  private async buildOptions(
    manager: EntityManager,
    createPoolDto: CreatePoolDto,
  ): Promise<PoolOption[]> {
    const gameRepository = manager.getRepository(Game);
    const optionRepository = manager.getRepository(PoolOption);

    return Promise.all(
      createPoolDto.options.map(async ({ gameId }) => {
        const game = await gameRepository.findOneBy({ id: gameId });

        if (!game) {
          throw new BadRequestException(`Game #${gameId} not found`);
        }

        return optionRepository.create({ game, players: [] });
      }),
    );
  }
}
