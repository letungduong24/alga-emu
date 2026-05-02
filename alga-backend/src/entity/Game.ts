import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("games")
export class Game {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  name!: string;

  @Column({ unique: true })
  filename!: string;

  @Index()
  @Column({ default: "nds" })
  platform!: string;

  @Column({ type: "bigint", default: 0 })
  size!: number;

  @Column()
  downloadUrl!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
