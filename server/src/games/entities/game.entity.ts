import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true })
  cover?: string | null;

  @Column({ default: false })
  suggestion: boolean;

  @Column({ nullable: true })
  steam: string | null;

  @Column({ nullable: true })
  trailer: string | null;
}
