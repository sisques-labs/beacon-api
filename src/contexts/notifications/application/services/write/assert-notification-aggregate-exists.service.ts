import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';

@Injectable()
export class AssertNotificationAggregateExistsService {
  private readonly logger = new Logger(
    AssertNotificationAggregateExistsService.name,
  );
  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
  ) {}

  async execute(id: string): Promise<NotificationAggregate> {
    this.logger.log(`Asserting notification aggregate ${id} exists`);

    const aggregate = await this.writeRepository.findById(id);

    if (!aggregate) {
      throw new NotificationNotFoundException(id);
    }

    return aggregate;
  }
}
