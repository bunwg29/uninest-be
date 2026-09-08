import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import type { Ward } from './ward';

@Entity('provinces')
export class Province {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 150, name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', length: 100, name: 'code_name' })
  codeName!: string;

  @OneToMany('Ward', 'province')
  wards?: Ward[];
}
