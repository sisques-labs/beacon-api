import { Column, Entity, Unique } from 'typeorm';
import { BaseTypeormEntity } from '@sisques-labs/nestjs-kit/typeorm';

@Entity('notifications')
@Unique(['tenantId', 'dedupeKey'])
export class NotificationEntity extends BaseTypeormEntity {
  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid' })
  recipientUserId!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 5000 })
  body!: string;

  @Column({ type: 'varchar', length: 255 })
  sourceService!: string;

  @Column({ type: 'varchar', length: 255 })
  dedupeKey!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  failureReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;
}
