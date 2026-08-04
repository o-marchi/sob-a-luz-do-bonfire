import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  cover?: string | null;

  @Column({ default: false })
  suggestion: boolean;

  @Column({ type: 'varchar', nullable: true })
  steam: string | null;

  @Column({ type: 'varchar', nullable: true })
  trailer: string | null;

  @Column({ type: 'varchar', nullable: true })
  summary: string | null;

  @Column({ name: 'how_long_to_beat_url', type: 'varchar', nullable: true })
  howLongToBeatUrl: string | null;

  @Column({ name: 'duration_label', type: 'varchar', nullable: true })
  durationLabel: string | null;

  @Column({ name: 'main_hours', type: 'float', nullable: true })
  mainHours: number | null;

  @Column({ name: 'main_extra_hours', type: 'float', nullable: true })
  mainExtraHours: number | null;

  @Column({ name: 'how_long_to_beat_title', type: 'varchar', nullable: true })
  howLongToBeatTitle: string | null;
}
