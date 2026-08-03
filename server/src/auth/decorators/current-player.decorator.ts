import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Player } from '../../players/entities/player.entity';
import type { Request } from 'express';

type RequestWithPlayer = Request & { user?: Player };

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Player | null => {
    const request = ctx.switchToHttp().getRequest<RequestWithPlayer>();
    return request.user ?? null;
  },
);
