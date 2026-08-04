import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PlayersService } from '../players/players.service';
import { AuthService } from './auth.service';
import { MediaStorageService } from '../media/media-storage.service';
import type { Profile } from 'passport-discord';
import { Player } from '../players/entities/player.entity';

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
        { provide: MediaStorageService, useValue: {} },
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

  it('persists the mirrored R2 avatar returned during Discord login', async () => {
    const sourceUrl =
      'https://cdn.discordapp.com/avatars/1234/abcdef123456.png';
    const storedUrl =
      'https://media.example.com/avatars/discord/1234/abcdef123456.png';
    const create: jest.MockedFunction<PlayersService['create']> = jest.fn(
      (dto) =>
        Promise.resolve({ id: 1, ...dto, campaigns: [] } as unknown as Player),
    );
    const playersService = {
      buildDiscordAvatarUrl: jest.fn().mockReturnValue(sourceUrl),
      findByDiscordId: jest.fn().mockResolvedValue(null),
      create,
    };
    const mediaStorageService = {
      storeDiscordAvatar: jest.fn().mockResolvedValue(storedUrl),
    };
    const service = new AuthService(
      playersService as unknown as PlayersService,
      {} as JwtService,
      mediaStorageService as unknown as MediaStorageService,
    );
    const profile = {
      id: '1234',
      username: 'ember',
      global_name: 'Ember',
      avatar: 'abcdef123456',
    } as unknown as Profile;

    const player = await service.validateDiscordUser(
      profile,
      'access-token',
      'refresh-token',
    );

    expect(mediaStorageService.storeDiscordAvatar).toHaveBeenCalledWith(
      '1234',
      'abcdef123456',
      sourceUrl,
    );
    expect(create.mock.calls[0][0].discord?.avatar).toBe(storedUrl);
    expect(player.discord?.avatar).toBe(storedUrl);
  });
});
