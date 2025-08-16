import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
