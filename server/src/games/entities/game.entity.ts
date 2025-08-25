import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({ nullable: true })
  cover?: string;

  @Column({ default: false })
  suggestion: boolean;
}
