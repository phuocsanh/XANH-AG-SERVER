import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DebtNote } from './debt-note.entity';
import { Customer } from './customer.entity';
import { Season } from './season.entity';
import { User } from './users.entity';

export enum DebtNoteClosureStatus {
  CLOSED = 'closed',
  REVERSED = 'reversed',
}

@Entity('debt_note_closures')
export class DebtNoteClosure {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'debt_note_id' })
  debt_note_id!: number;

  @ManyToOne(() => DebtNote)
  @JoinColumn({ name: 'debt_note_id' })
  debt_note?: DebtNote;

  @Column({ name: 'customer_id' })
  customer_id!: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  @Column({ name: 'season_id', nullable: true })
  season_id?: number | null;

  @ManyToOne(() => Season, { nullable: true })
  @JoinColumn({ name: 'season_id' })
  season?: Season | null;

  @Column({ name: 'closed_by', nullable: true })
  closed_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closer?: User | null;

  @Column({ name: 'closed_at', type: 'timestamp' })
  closed_at!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DebtNoteClosureStatus,
    default: DebtNoteClosureStatus.CLOSED,
  })
  status!: DebtNoteClosureStatus;

  @Column({ name: 'reversed_by', nullable: true })
  reversed_by?: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reversed_by' })
  reverser?: User | null;

  @Column({ name: 'reversed_at', type: 'timestamp', nullable: true })
  reversed_at?: Date | null;

  @Column({ name: 'reverse_reason', type: 'text', nullable: true })
  reverse_reason?: string | null;

  @Column({ name: 'before_snapshot', type: 'jsonb' })
  before_snapshot!: Record<string, any>;

  @Column({ name: 'after_snapshot', type: 'jsonb' })
  after_snapshot!: Record<string, any>;

  @Column({ name: 'reward_tracking_before', type: 'jsonb', nullable: true })
  reward_tracking_before?: Record<string, any> | null;

  @Column({ name: 'reward_tracking_after', type: 'jsonb', nullable: true })
  reward_tracking_after?: Record<string, any> | null;

  @Column({ name: 'reward_history_ids', type: 'jsonb', nullable: true })
  reward_history_ids?: number[] | null;

  @Column({ name: 'inventory_transaction_ids', type: 'jsonb', nullable: true })
  inventory_transaction_ids?: number[] | null;

  @Column({ name: 'gift_cost_ids', type: 'jsonb', nullable: true })
  gift_cost_ids?: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
