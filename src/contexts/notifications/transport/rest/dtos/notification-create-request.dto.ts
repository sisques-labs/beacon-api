import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';

export class NotificationCreateRequestDto {
  @ApiProperty()
  @IsUUID()
  tenantId!: string;

  @ApiProperty()
  @IsUUID()
  recipientUserId!: string;

  // D5: the domain enum is exposed, but the write path only accepts DISCORD —
  // delivery has no channel branch, every created notification is sent to
  // Discord, so EMAIL/PUSH are rejected explicitly rather than silently
  // mis-delivered.
  @ApiProperty({ enum: [NotificationChannelEnum.DISCORD] })
  @IsEnum(NotificationChannelEnum)
  @IsIn([NotificationChannelEnum.DISCORD])
  channel!: NotificationChannelEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceService!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dedupeKey!: string;

  @ApiPropertyOptional({
    enum: NotificationDeliveryModeEnum,
    default: NotificationDeliveryModeEnum.DELIVER,
  })
  @IsOptional()
  @IsEnum(NotificationDeliveryModeEnum)
  deliveryMode?: NotificationDeliveryModeEnum;
}
