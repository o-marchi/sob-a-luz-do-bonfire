import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DiscordStrategy } from './strategies/discord.strategy';
import { PlayersModule } from '../players/players.module';
import { JwtStrategy } from './strategies/jwt.strategy'; // assumes you have this
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    ConfigModule,
    PlayersModule,
    MediaModule,
    PassportModule.register({ defaultStrategy: 'discord', session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: 60 * 60 * 24 * 180 },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DiscordStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
