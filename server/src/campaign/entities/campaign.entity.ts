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

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => Game, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'game_id' })
  game?: Game | null;

  @OneToMany(
    () => CampaignPlayer,
    (campaignPlayer: CampaignPlayer) => campaignPlayer.campaign,
    { cascade: true },
  )
  players: CampaignPlayer[];
}
