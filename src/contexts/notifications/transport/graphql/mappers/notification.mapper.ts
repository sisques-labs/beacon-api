import { Injectable } from '@nestjs/common';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationObject } from '@contexts/notifications/transport/graphql/objects/notification.object';

@Injectable()
export class NotificationGraphqlMapper {
  toObject(viewModel: NotificationViewModel): NotificationObject {
    const object = new NotificationObject();

    object.id = viewModel.id;
    object.tenantId = viewModel.tenantId;
    object.recipientUserId = viewModel.recipientUserId;
    object.channel = viewModel.channel as NotificationChannelEnum;
    object.status = viewModel.status as NotificationStatusEnum;
    object.title = viewModel.title;
    object.body = viewModel.body;
    object.sourceService = viewModel.sourceService;
    object.dedupeKey = viewModel.dedupeKey;
    object.failureReason = viewModel.failureReason;
    object.sentAt = viewModel.sentAt;
    object.readAt = viewModel.readAt;
    object.cancelledAt = viewModel.cancelledAt;
    object.createdAt = viewModel.createdAt;
    object.updatedAt = viewModel.updatedAt;

    return object;
  }
}
