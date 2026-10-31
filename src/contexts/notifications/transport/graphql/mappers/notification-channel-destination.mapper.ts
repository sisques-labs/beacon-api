import { Injectable } from '@nestjs/common';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/graphql/dtos/responses/notification-channel-destination.response.dto';

@Injectable()
export class NotificationChannelDestinationGraphQLMapper {
  /**
   * `viewModel` is `null` for an unregistered `(tenantId, channel)` pair —
   * that is a valid outcome, not an error (spec: "Metadata-Only Reads"). The
   * webhook URL never enters this mapper: `NotificationChannelDestinationViewModel`
   * has no envelope field to begin with (D10).
   */
  toResponseDtoFromViewModel(
    viewModel: NotificationChannelDestinationViewModel | null,
  ): NotificationChannelDestinationResponseDto {
    const dto = new NotificationChannelDestinationResponseDto();

    if (!viewModel) {
      dto.configured = false;
      return dto;
    }

    dto.configured = true;
    dto.id = viewModel.id;
    dto.channel = viewModel.channel as NotificationChannelEnum;
    dto.createdAt = viewModel.createdAt;
    dto.updatedAt = viewModel.updatedAt;

    return dto;
  }
}
