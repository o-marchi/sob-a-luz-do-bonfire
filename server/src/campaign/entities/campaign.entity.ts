import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Game } from '../../games/entities/game.entity';
import { CampaignPlayer } from './campaign-player.entity';
import { Pool } from '../../pool/entities/pool.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  month: string;

  @Column()
  year: string;

  @Column({ default: false })
  current: boolean;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'meeting_at', type: 'varchar', nullable: true })
  meetingAt: string | null;

  @Column({ name: 'meeting_location', type: 'varchar', nullable: true })
  meetingLocation: string | null;

  @Column({ name: 'meeting_url', type: 'varchar', nullable: true })
  meetingUrl: string | null;

  @ManyToOne(() => Game, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'game_id' })
  game?: Game | null;

  @OneToMany(
    () => CampaignPlayer,
    (campaignPlayer: CampaignPlayer) => campaignPlayer.campaign,
    { cascade: true },
  )
  players: CampaignPlayer[];

  @Column({ default: false })
  electionActive: boolean;

  @ManyToOne(() => Pool, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pool_id' })
  pool?: Pool | null;
}
