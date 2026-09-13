import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  IInboundMessage,
  KafkaMessageHandler,
} from '@sisques-labs/nestjs-kit/messaging';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { kafkaIngestConfig } from '@core/config/kafka-ingest.config';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationIngestDto } from '@contexts/notifications/transport/kafka/dtos/notification-ingest.dto';

/**
 * Declarative inbound Kafka consumer for the notification-request topic
 * (design.md D1), registered via the kit's `MessagingModule.forRoot({
 * inboundConsumers })` in `core.module.ts` — that registration is gated on
 * `KAFKA_INGEST_ENABLED`, so this handler is only ever invoked when
 * ingestion is enabled. Thin dispatcher: validate, then hand off to
 * `CommandBus`. Never awaits delivery.
 */
@Injectable()
export class NotificationIngestConsumer {
  private readonly logger = new Logger(NotificationIngestConsumer.name);

  constructor(private readonly commandBus: CommandBus) {}

  @KafkaMessageHandler({ topic: kafkaIngestConfig().topic })
  async handleMessage(message: IInboundMessage): Promise<void> {
    const raw = message.value;
    if (!raw) {
      this.logger.warn('Skipping empty notification-request message');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(
        `Skipping malformed (non-JSON) notification-request message: ${raw}`,
      );
      return;
    }

    const dto = plainToInstance(NotificationIngestDto, parsed);
    const errors = await validate(dto);
    if (errors.length > 0) {
      this.logger.warn(
        `Skipping invalid notification-request event: ${errors
          .map((error) => error.property)
          .join(', ')}`,
      );
      return;
    }

    if (dto.deliverableAddress) {
      this.logger.warn(
        `Ignoring caller-supplied deliverableAddress for tenant ${dto.tenantId} — the Discord destination is Beacon-side config only`,
      );
    }

    if (dto.channel !== NotificationChannelEnum.DISCORD) {
      this.logger.log(
        `Skipping unsupported-for-this-change channel ${dto.channel} for tenant ${dto.tenantId}`,
      );
      return;
    }

    await this.commandBus.execute(
      new CreateNotificationCommand({
        tenantId: dto.tenantId,
        recipientUserId: dto.recipientUserId,
        channel: dto.channel,
        title: dto.title,
        body: dto.body,
        sourceService: dto.sourceService,
        dedupeKey: dto.dedupeKey,
      }),
    );
  }
}
