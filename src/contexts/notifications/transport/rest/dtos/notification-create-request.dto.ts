import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

export class NotificationCreateRequestDto {
  // D22: deprecated for one release, accepted and ignored. The creation
  // tenant is always the authenticated client's own tenant (see
  // NotificationController) — this field is NEVER read to determine it.
  @ApiProperty({
    required: false,
    deprecated: true,
    description:
      "Deprecated, ignored. The creation tenant is always the authenticated client's own tenant.",
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

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
}
