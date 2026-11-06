import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import { EncryptChannelDestinationSecretService } from '@contexts/notifications/application/services/write/encrypt-channel-destination-secret/encrypt-channel-destination-secret.service';
import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';
import {
  INotificationChannelDestinationWriteRepository,
  NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';

/**
 * Implements design.md's register/rotate flow: encrypt once (bound to the destination's tenant and channel),
 * then upsert via find-then-save (D12). The write repository translates a
 * unique-constraint violation into `DestinationAlreadyExistsException`, so
 * this handler catches only that domain exception and retries exactly once,
 * re-reading the row that just won the race and rotating it instead of
 * creating a second one.
 */
@CommandHandler(RegisterNotificationChannelDestinationCommand)
export class RegisterNotificationChannelDestinationCommandHandler
  extends BaseCommandHandler<
    RegisterNotificationChannelDestinationCommand,
    NotificationChannelDestinationAggregate
  >
  implements
    ICommandHandler<
      RegisterNotificationChannelDestinationCommand,
      RegisterNotificationChannelDestinationResult
    >
{
  private readonly logger = new Logger(
    RegisterNotificationChannelDestinationCommandHandler.name,
  );

  constructor(
    @Inject(NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY)
    private readonly writeRepository: INotificationChannelDestinationWriteRepository,
    private readonly encryptChannelDestinationSecretService: EncryptChannelDestinationSecretService,
    private readonly destinationBuilder: NotificationChannelDestinationBuilder,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: RegisterNotificationChannelDestinationCommand,
  ): Promise<RegisterNotificationChannelDestinationResult> {
    const encryptedWebhookUrl =
      await this.encryptChannelDestinationSecretService.execute({
        tenantId: command.tenantId.value,
        channel: command.channel.value,
        plaintext: command.webhookUrl.value,
      });

    return this.upsert(command, encryptedWebhookUrl, false);
  }

  private async upsert(
    command: RegisterNotificationChannelDestinationCommand,
    encryptedWebhookUrl: string,
    isRetry: boolean,
  ): Promise<RegisterNotificationChannelDestinationResult> {
    const existing = await this.writeRepository.findByTenantAndChannel(
      command.tenantId.value,
      command.channel.value,
    );

    if (existing) {
      existing.rotate(new EncryptedSecretValueObject(encryptedWebhookUrl));
      await this.writeRepository.save(existing);
      await this.publishEvents(existing);
      this.logger.log(
        `Notification channel destination ${existing.id.value} rotated`,
      );
      return { id: existing.id.value };
    }

    const now = new Date();
    // The builder is a shared mutable singleton: every field is set on each use.
    const aggregate = this.destinationBuilder
      .withId(UuidValueObject.generate().value)
      .withTenantId(command.tenantId.value)
      .withChannel(command.channel.value)
      .withEnvelope(encryptedWebhookUrl)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();
    aggregate.register();

    try {
      await this.writeRepository.save(aggregate);
    } catch (error) {
      if (!isRetry && error instanceof DestinationAlreadyExistsException) {
        return this.upsert(command, encryptedWebhookUrl, true);
      }
      throw error;
    }

    await this.publishEvents(aggregate);
    this.logger.log(
      `Notification channel destination ${aggregate.id.value} registered`,
    );
    return { id: aggregate.id.value };
  }
}
