import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PlayersService } from '../players/players.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('does not include the Discord access token in the signed JWT payload', async () => {
    const signAsync: jest.MockedFunction<
      (payload: Record<string, unknown>) => Promise<string>
    > = jest.fn().mockResolvedValue('signed-token');
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PlayersService, useValue: {} },
        { provide: JwtService, useValue: { signAsync } },
      ],
    }).compile();
    const service = module.get(AuthService);
    const player = {
      id: 1,
      name: 'Player',
      email: 'player@example.com',
      discord: { id: 'discord-id', username: 'player' },
      campaigns: [],
      accessToken: 'sensitive-token',
    };

    await expect(service.signToken(player)).resolves.toBe('signed-token');
    expect(signAsync).toHaveBeenCalledWith({
      id: player.id,
      email: player.email,
      name: player.name,
      discord: player.discord,
    });
    expect(signAsync.mock.calls[0][0]).not.toHaveProperty('accessToken');
  });
});
