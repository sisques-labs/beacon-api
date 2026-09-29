import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  BaseCommandHandler,
  Criteria,
  FilterOperator,
  UuidValueObject,
} from '@sisques-labs/nestjs-kit';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import {
  ISecretCipherPort,
  SECRET_CIPHER_PORT,
} from '@contexts/notifications/application/ports/secret-cipher.port';
import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import { DestinationAlreadyExistsException } from '@contexts/notifications/domain/exceptions/destination-already-exists.exception';
import {
  INotificationChannelDestinationWriteRepository,
  NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';

/**
 * Implements design.md's register/rotate flow: encrypt once with the D5 AAD,
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
    @Inject(SECRET_CIPHER_PORT)
    private readonly secretCipherPort: ISecretCipherPort,
    eventBus: EventBus,
  ) {
    super(eventBus);
  }

  async execute(
    command: RegisterNotificationChannelDestinationCommand,
  ): Promise<RegisterNotificationChannelDestinationResult> {
    const aad = this.buildAad(command.tenantId.value, command.channel.value);
    const envelopeValue = await this.secretCipherPort.encrypt(
      command.webhookUrl.value,
      aad,
    );

    return this.upsert(command, envelopeValue, false);
  }

  private async upsert(
    command: RegisterNotificationChannelDestinationCommand,
    envelopeValue: string,
    isRetry: boolean,
  ): Promise<RegisterNotificationChannelDestinationResult> {
    const existing = await this.findExisting(command);

    if (existing) {
      existing.rotate(new EncryptedSecretValueObject(envelopeValue));
      await this.writeRepository.save(existing);
      await this.publishEvents(existing);
      this.logger.log(
        `Notification channel destination ${existing.id.value} rotated`,
      );
      return { id: existing.id.value };
    }

    const now = new Date();
    const aggregate = new NotificationChannelDestinationBuilder()
      .withId(UuidValueObject.generate().value)
      .withTenantId(command.tenantId.value)
      .withChannel(command.channel.value)
      .withEnvelope(envelopeValue)
      .withCreatedAt(now)
      .withUpdatedAt(now)
      .build();
    aggregate.register();

    try {
      await this.writeRepository.save(aggregate);
    } catch (error) {
      if (!isRetry && error instanceof DestinationAlreadyExistsException) {
        return this.upsert(command, envelopeValue, true);
      }
      throw error;
    }

    await this.publishEvents(aggregate);
    this.logger.log(
      `Notification channel destination ${aggregate.id.value} registered`,
    );
    return { id: aggregate.id.value };
  }

  /**
   * The unique index `(tenantId, channel)` guarantees at most one row, so the
   * default first page of `findByCriteria` (page 1, perPage 10) is enough.
   */
  private async findExisting(
    command: RegisterNotificationChannelDestinationCommand,
  ): Promise<NotificationChannelDestinationAggregate | null> {
    const result = await this.writeRepository.findByCriteria(
      new Criteria([
        {
          field: 'tenantId',
          operator: FilterOperator.EQUALS,
          value: command.tenantId.value,
        },
        {
          field: 'channel',
          operator: FilterOperator.EQUALS,
          value: command.channel.value,
        },
      ]),
    );
    return result.items[0] ?? null;
  }

  private buildAad(tenantId: string, channel: string): string {
    return `notifications:channel-destination:${tenantId}:${channel}`;
  }
}
