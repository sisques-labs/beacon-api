import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  recipientUserId!: string;

  @ApiProperty()
  channel!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  sourceService!: string;

  @ApiProperty()
  dedupeKey!: string;

  @ApiProperty()
  deliveryMode!: string;

  @ApiProperty({ nullable: true, type: String })
  failureReason!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  sentAt!: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  readAt!: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  cancelledAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
