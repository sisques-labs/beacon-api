import { ApiProperty } from '@nestjs/swagger';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';

export class NotificationCreateResponseDto {
  @ApiProperty()
  id: string;

  constructor(result: CreateNotificationResult) {
    this.id = result.id;
  }
}
