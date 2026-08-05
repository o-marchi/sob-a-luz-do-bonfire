import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { PlayersService } from '../../players/players.service';
import { Player } from '../../players/entities/player.entity';
import { BONFIRE_AUTH_VERSION } from '../auth.constants';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const player = { id: 1, name: 'Ember' } as Player;
  const playerService = {
    findOne: jest.fn().mockResolvedValue(player),
  };
  const strategy = new JwtStrategy(
    {
      getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
    } as unknown as ConfigService,
    playerService as unknown as PlayersService,
  );

  beforeEach(() => {
    playerService.findOne.mockClear();
  });

  it('accepts sessions issued after Discord membership verification', async () => {
    await expect(
      strategy.validate({ id: 1, authVersion: BONFIRE_AUTH_VERSION }),
    ).resolves.toBe(player);
    expect(playerService.findOne).toHaveBeenCalledWith(1);
  });

  it('invalidates sessions issued before the Discord membership gate', async () => {
    await expect(strategy.validate({ id: 1 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(playerService.findOne).not.toHaveBeenCalled();
  });
});
