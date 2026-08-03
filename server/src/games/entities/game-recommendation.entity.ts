import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { Game } from './game.entity';

@Entity('game_recommendations')
@Unique('UQ_game_recommendations_game_player', ['game', 'player'])
export class GameRecommendation {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game!: Game;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player!: Player;
}
