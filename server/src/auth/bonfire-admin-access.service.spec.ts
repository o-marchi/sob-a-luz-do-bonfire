import { ConfigService } from '@nestjs/config';
import { BonfireAdminAccessService } from './bonfire-admin-access.service';

describe('BonfireAdminAccessService', () => {
  it('allows only the single configured conductor Discord identity', () => {
    const service = new BonfireAdminAccessService(
      new ConfigService({ BONFIRE_CONDUCTOR_DISCORD_ID: 'owner-id' }),
    );

    expect(service.isAdmin({ discord: { id: 'owner-id' } })).toBe(true);
    expect(service.isAdmin({ discord: { id: 'other-id' } })).toBe(false);
    expect(service.isAdmin(undefined)).toBe(false);
  });

  it('fails closed when no conductor is configured', () => {
    const service = new BonfireAdminAccessService(new ConfigService({}));

    expect(service.isAdmin({ discord: { id: 'owner-id' } })).toBe(false);
  });
});
