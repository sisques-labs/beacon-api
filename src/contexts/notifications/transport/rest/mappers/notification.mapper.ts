import { Injectable } from '@nestjs/common';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationCreateResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-create-response.dto';
import { NotificationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-response.dto';

@Injectable()
export class NotificationRestMapper {
  toResponseDtoFromResult(
    result: CreateNotificationResult,
  ): NotificationCreateResponseDto {
    const dto = new NotificationCreateResponseDto();

    dto.id = result.id;

    return dto;
  }

  toResponseDtoFromViewModel(
    viewModel: NotificationViewModel,
  ): NotificationResponseDto {
    const dto = new NotificationResponseDto();

    dto.id = viewModel.id;
    dto.tenantId = viewModel.tenantId;
    dto.recipientUserId = viewModel.recipientUserId;
    dto.channel = viewModel.channel;
    dto.status = viewModel.status;
    dto.title = viewModel.title;
    dto.body = viewModel.body;
    dto.sourceService = viewModel.sourceService;
    dto.dedupeKey = viewModel.dedupeKey;
    dto.deliveryMode = viewModel.deliveryMode;
    dto.failureReason = viewModel.failureReason;
    dto.sentAt = viewModel.sentAt;
    dto.readAt = viewModel.readAt;
    dto.cancelledAt = viewModel.cancelledAt;
    dto.createdAt = viewModel.createdAt;
    dto.updatedAt = viewModel.updatedAt;

    return dto;
  }
}
