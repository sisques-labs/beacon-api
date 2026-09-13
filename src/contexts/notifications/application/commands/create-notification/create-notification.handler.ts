import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { FindNotificationByDedupeKeyService } from '@contexts/notifications/application/services/write/find-notification-by-dedupe-key/find-notification-by-dedupe-key.service';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationCommandHandler
  extends BaseCommandHandler<CreateNotificationCommand, NotificationAggregate>
  implements
    ICommandHandler<CreateNotificationCommand, CreateNotificationResult>
{
  private readonly logger = new Logger(CreateNotificationCommandHandler.name);

  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
    private readonly findNotificationByDedupeKeyService: FindNotificationByDedupeKeyService,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: CreateNotificationCommand,
  ): Promise<CreateNotificationResult> {
    const existing = await this.findNotificationByDedupeKeyService.execute({
      tenantId: command.tenantId.value,
      dedupeKey: command.dedupeKey.value,
    });
    if (existing) {
      return existing;
    }

    const now = new Date();

    const aggregate = new NotificationBuilder()
      .withId(UuidValueObject.generate().value)
      .withTenantId(command.tenantId.value)
      .withRecipientUserId(command.recipientUserId.value)
      .withChannel(command.channel.value)
      .withTitle(command.title.value)
      .withBody(command.body.value)
      .withSourceService(command.sourceService.value)
      .withDedupeKey(command.dedupeKey.value)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();

    aggregate.create();

    try {
      await this.writeRepository.save(aggregate);
      await this.publishEvents(aggregate);
      this.logger.log(`Notification ${aggregate.id.value} created`);
      return { id: aggregate.id.value };
    } catch (error) {
      if (error instanceof NotificationDedupeKeyAlreadyExistsException) {
        const raceWinner =
          await this.findNotificationByDedupeKeyService.execute({
            tenantId: command.tenantId.value,
            dedupeKey: command.dedupeKey.value,
          });
        if (raceWinner) {
          return raceWinner;
        }
      }
      throw error;
    }
  }
}
