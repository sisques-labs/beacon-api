import { Injectable } from '@nestjs/common';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification/notification.response.dto';

@Injectable()
export class NotificationGraphQLMapper {
  toResponseDtoFromViewModel(
    viewModel: NotificationViewModel,
  ): NotificationResponseDto {
    const dto = new NotificationResponseDto();

    dto.id = viewModel.id;
    dto.tenantId = viewModel.tenantId;
    dto.recipientUserId = viewModel.recipientUserId;
    dto.channel = viewModel.channel as NotificationChannelEnum;
    dto.status = viewModel.status as NotificationStatusEnum;
    dto.title = viewModel.title;
    dto.body = viewModel.body;
    dto.sourceService = viewModel.sourceService;
    dto.dedupeKey = viewModel.dedupeKey;
    dto.failureReason = viewModel.failureReason;
    dto.sentAt = viewModel.sentAt;
    dto.readAt = viewModel.readAt;
    dto.cancelledAt = viewModel.cancelledAt;
    dto.createdAt = viewModel.createdAt;
    dto.updatedAt = viewModel.updatedAt;

    return dto;
  }
}
