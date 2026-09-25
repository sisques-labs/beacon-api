import { Column, Entity, Unique } from 'typeorm';
import { BaseTypeormEntity } from '@sisques-labs/nestjs-kit/typeorm';

@Entity('notification_channel_destinations')
@Unique(['tenantId', 'channel'])
export class NotificationChannelDestinationEntity extends BaseTypeormEntity {
  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  channel!: string;

  @Column({ type: 'text' })
  encryptedAddress!: string;
}
