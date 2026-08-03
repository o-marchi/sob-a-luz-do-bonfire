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
}
