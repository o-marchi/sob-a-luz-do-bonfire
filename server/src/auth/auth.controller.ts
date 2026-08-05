import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import express from 'express';
import { AuthPlayer, AuthService } from './auth.service';
import { DiscordCallbackGuard } from './guards/discord-callback.guard';
import type { DiscordCallbackRequest } from './guards/discord-callback.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  // 1) Redirect user to Discord
  @Get('discord')
  @UseGuards(AuthGuard('discord'))
  async discordLogin() {
    // Passport handles the redirect to Discord.
  }

  // 2) Discord callback
  @Get('discord/callback')
  @UseGuards(DiscordCallbackGuard)
  async discordCallback(
    @Req() req: DiscordCallbackRequest,
    @Res() res: express.Response,
  ) {
    const player = req.user as AuthPlayer;
    const clientUrl: string =
      this.config.getOrThrow<string>('PUBLIC_CLIENT_URL');

    if (!player) {
      const redirectUrl = new URL(clientUrl);
      redirectUrl.searchParams.set(
        'authentication_error',
        req.discordAuthenticationError ?? 'true',
      );
      return res.redirect(302, redirectUrl.toString());
    }

    const token: string = await this.authService.signToken(player);
    const redirectUrl = new URL('/auth/callback', clientUrl);
    redirectUrl.searchParams.append('jwt', token);

    return res.redirect(302, redirectUrl.toString());
  }
}
