import { Injectable } from '@nestjs/common';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { NotificationCreateResponseDto } from '@contexts/notifications/transport/rest/dtos/notification-create-response.dto';

@Injectable()
export class NotificationRestMapper {
  toResponseDtoFromResult(
    result: CreateNotificationResult,
  ): NotificationCreateResponseDto {
    const dto = new NotificationCreateResponseDto();

    dto.id = result.id;

    return dto;
  }
}
