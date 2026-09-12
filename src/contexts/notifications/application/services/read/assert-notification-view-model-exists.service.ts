import { Inject, Injectable } from '@nestjs/common';

import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import {
  INotificationReadRepository,
  NOTIFICATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

@Injectable()
export class AssertNotificationViewModelExistsService {
  constructor(
    @Inject(NOTIFICATION_READ_REPOSITORY)
    private readonly readRepository: INotificationReadRepository,
  ) {}

  async execute(id: string): Promise<NotificationViewModel> {
    const viewModel = await this.readRepository.findById(id);
    if (!viewModel) {
      throw new NotificationNotFoundException(id);
    }
    return viewModel;
  }
}
