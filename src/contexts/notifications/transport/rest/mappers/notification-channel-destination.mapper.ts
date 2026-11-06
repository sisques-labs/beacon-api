import { Injectable } from '@nestjs/common';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationRegisterResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-register-response.dto';
import { NotificationChannelDestinationResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-channel-destination-response.dto';

@Injectable()
export class NotificationChannelDestinationRestMapper {
  toResponseDtoFromResult(
    result: RegisterNotificationChannelDestinationResult,
  ): NotificationChannelDestinationRegisterResponseDto {
    const dto = new NotificationChannelDestinationRegisterResponseDto();

    dto.id = result.id;

    return dto;
  }

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
    dto.channel = viewModel.channel;
    dto.createdAt = viewModel.createdAt;
    dto.updatedAt = viewModel.updatedAt;

    return dto;
  }
}
