import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CampaignPlayer } from '../../campaign/entities/campaign-player.entity';

export class DiscordProfile {
  @Column({ name: 'discordId', type: 'varchar', nullable: true })
  id?: string | null;

  @Column({ name: 'username', type: 'varchar', nullable: true })
  username?: string | null;

  @Column({ name: 'global_name', type: 'varchar', nullable: true })
  globalName?: string | null;

  @Column({ name: 'avatar', type: 'varchar', nullable: true })
  avatar?: string | null;
}

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  name?: string | null;

  @Column(() => DiscordProfile, { prefix: false })
  discord?: DiscordProfile;

  @OneToMany(
    () => CampaignPlayer,
    (campaignPlayer: CampaignPlayer) => campaignPlayer.player,
    { cascade: true },
  )
  campaigns: CampaignPlayer[];
}
