import { ApiProperty } from '@nestjs/swagger';

import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  recipientUserId: string;

  @ApiProperty()
  channel: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty()
  sourceService: string;

  @ApiProperty()
  dedupeKey: string;

  @ApiProperty({ nullable: true, type: String })
  failureReason: string | null;

  @ApiProperty({ nullable: true, type: Date })
  sentAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  readAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  cancelledAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(viewModel: NotificationViewModel) {
    this.id = viewModel.id;
    this.tenantId = viewModel.tenantId;
    this.recipientUserId = viewModel.recipientUserId;
    this.channel = viewModel.channel;
    this.status = viewModel.status;
    this.title = viewModel.title;
    this.body = viewModel.body;
    this.sourceService = viewModel.sourceService;
    this.dedupeKey = viewModel.dedupeKey;
    this.failureReason = viewModel.failureReason;
    this.sentAt = viewModel.sentAt;
    this.readAt = viewModel.readAt;
    this.cancelledAt = viewModel.cancelledAt;
    this.createdAt = viewModel.createdAt;
    this.updatedAt = viewModel.updatedAt;
  }
}
