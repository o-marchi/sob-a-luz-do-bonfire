import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { Player } from '../../players/entities/player.entity';
import { BonfireAdminAccessService } from '../bonfire-admin-access.service';

type AuthenticatedRequest = Request & { user?: Player };

@Injectable()
export class BonfireAdminGuard implements CanActivate {
  constructor(private readonly access: BonfireAdminAccessService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!this.access.isAdmin(request.user)) {
      throw new ForbiddenException(
        'Only a cycle conductor can perform this action',
      );
    }

    return true;
  }
}
