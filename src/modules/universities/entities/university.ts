import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('universities')
export class University {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;
}
