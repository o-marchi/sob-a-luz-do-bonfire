import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('site_content')
export class SiteContent {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key!: string;

  @Column({ type: 'text' })
  content!: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
