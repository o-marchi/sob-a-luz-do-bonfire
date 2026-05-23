import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken =
      this.config.get<string>('MCP_ADMIN_TOKEN') ??
      this.config.get<string>('ADMIN_API_TOKEN');

    if (!expectedToken) {
      throw new UnauthorizedException('Admin API token is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const bearerToken = this.getBearerToken(request.headers.authorization);
    const adminHeaderToken = this.getSingleHeaderValue(
      request.headers['x-admin-token'],
    );

    if (bearerToken === expectedToken || adminHeaderToken === expectedToken) {
      return true;
    }

    throw new UnauthorizedException('Invalid admin API token');
  }

  private getBearerToken(authorization: string | undefined): string | null {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length).trim();
  }

  private getSingleHeaderValue(
    value: string | string[] | undefined,
  ): string | null {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
