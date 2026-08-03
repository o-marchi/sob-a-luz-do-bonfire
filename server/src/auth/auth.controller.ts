import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import express from 'express';
import { AuthPlayer, AuthService } from './auth.service';

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
  @UseGuards(AuthGuard('discord'))
  async discordCallback(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    const player = req.user as AuthPlayer;
    const clientUrl: string =
      this.config.getOrThrow<string>('PUBLIC_CLIENT_URL');

    if (!player) {
      return res.redirect(302, `${clientUrl}?authentication_error=true`);
    }

    const token: string = await this.authService.signToken(player);
    const redirectUrl = new URL('/auth/callback', clientUrl);
    redirectUrl.searchParams.append('jwt', token);
    redirectUrl.searchParams.append('access_token', player.accessToken);

    return res.redirect(302, redirectUrl.toString());
  }
}
