import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { BaseCommandHandler, UuidValueObject } from '@sisques-labs/nestjs-kit';
import { QueryFailedError } from 'typeorm';

import { RegisterNotificationChannelDestinationResult } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination-result.interface';
import { RegisterNotificationChannelDestinationCommand } from '@contexts/notifications/application/commands/register-notification-channel-destination/register-notification-channel-destination.command';
import {
  ISecretCipherPort,
  SECRET_CIPHER_PORT,
} from '@contexts/notifications/application/ports/secret-cipher.port';
import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';
import {
  INotificationChannelDestinationWriteRepository,
  NOTIFICATION_CHANNEL_DESTINATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-channel-destination-write.repository';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';

const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Implements design.md's register/rotate flow: encrypt once with the D5 AAD,
 * then upsert via find-then-save (D12). The write repository never
 * translates a `23505` into a domain exception for this aggregate (see
 * apply-progress.md Phase 5 deviations), so this handler catches the raw
 * TypeORM `QueryFailedError` directly and retries exactly once, re-reading
 * the row that just won the race and rotating it instead of creating a
 * second one.
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
    const envelopeValue = this.secretCipherPort.encrypt(
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
    const existing = await this.writeRepository.findByTenantAndChannel(
      command.tenantId.value,
      command.channel.value,
    );

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
      if (!isRetry && this.isUniqueViolation(error)) {
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === UNIQUE_VIOLATION_CODE
    );
  }

  private buildAad(tenantId: string, channel: string): string {
    return `notifications:channel-destination:${tenantId}:${channel}`;
  }
}
