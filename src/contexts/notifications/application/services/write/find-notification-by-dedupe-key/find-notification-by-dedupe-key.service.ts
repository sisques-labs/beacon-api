import { Inject, Injectable } from '@nestjs/common';
import { IBaseService } from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

export interface FindNotificationByDedupeKeyInput {
  tenantId: string;
  dedupeKey: string;
}

@Injectable()
export class FindNotificationByDedupeKeyService
  implements
    IBaseService<FindNotificationByDedupeKeyInput, NotificationAggregate | null>
{
  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
  ) {}

  async execute(
    input: FindNotificationByDedupeKeyInput,
  ): Promise<NotificationAggregate | null> {
    return this.writeRepository.findByDedupeKey(
      input.tenantId,
      input.dedupeKey,
    );
  }
}
