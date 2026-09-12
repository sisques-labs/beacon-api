import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { UuidValueObject } from '@sisques-labs/nestjs-kit';

import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

@CommandHandler(CreateNotificationCommand)
export class CreateNotificationCommandHandler implements ICommandHandler<
  CreateNotificationCommand,
  CreateNotificationResult
> {
  private readonly logger = new Logger(CreateNotificationCommandHandler.name);

  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationWriteRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(
    command: CreateNotificationCommand,
  ): Promise<CreateNotificationResult> {
    const existing = await this.writeRepository.findByDedupeKey(
      command.tenantId.value,
      command.dedupeKey.value,
    );
    if (existing) {
      this.logger.log(
        `Idempotent no-op: notification already exists for tenant ${command.tenantId.value}, dedupeKey ${command.dedupeKey.value}`,
      );
      return { id: existing.id.value };
    }

    const aggregate = this.publisher.mergeObjectContext(
      this.buildPendingAggregate(command),
    );
    aggregate.create();

    try {
      const saved = await this.writeRepository.save(aggregate);
      aggregate.commit();
      this.logger.log(`Notification ${saved.id.value} created`);
      return { id: saved.id.value };
    } catch (error) {
      if (error instanceof NotificationDedupeKeyAlreadyExistsException) {
        const raceWinner = await this.writeRepository.findByDedupeKey(
          command.tenantId.value,
          command.dedupeKey.value,
        );
        if (raceWinner) {
          this.logger.log(
            `Lost dedupe race for tenant ${command.tenantId.value}, dedupeKey ${command.dedupeKey.value}; returning existing notification`,
          );
          return { id: raceWinner.id.value };
        }
      }
      throw error;
    }
  }

  private buildPendingAggregate(
    command: CreateNotificationCommand,
  ): NotificationAggregate {
    const now = new Date();
    return new NotificationBuilder()
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
  }
}
