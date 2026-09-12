import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

/**
 * Shape of an inbound notification-request Kafka event.
 *
 * Deliberately has NO deliverable-address/destination field — the Discord
 * webhook URL is Beacon-side config only (SSRF mitigation for this
 * unauthenticated topic, see design.md decision D3). `deliverableAddress` is
 * accepted here only so a caller-supplied value can be detected, logged, and
 * ignored by the consumer rather than triggering a validation failure.
 */
export class NotificationIngestDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  recipientUserId!: string;

  @IsEnum(NotificationChannelEnum)
  channel!: NotificationChannelEnum;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsNotEmpty()
  sourceService!: string;

  @IsString()
  @IsNotEmpty()
  dedupeKey!: string;

  @IsOptional()
  @IsString()
  deliverableAddress?: string;
}
