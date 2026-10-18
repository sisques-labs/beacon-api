import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  IInboundMessage,
  KafkaMessageHandler,
} from '@sisques-labs/nestjs-kit/messaging';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { kafkaIngestConfig } from '@core/config/kafka-ingest.config';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import {
  CLIENT_AUTHENTICATION_PORT,
  IClientAuthenticationPort,
} from '@contexts/notifications/application/ports/client-authentication.port';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { buildIngestAuthenticationRejectedWarning } from '@contexts/notifications/infrastructure/logging/kafka-ingest-authentication-warning';
import { warnIfTenantIdMismatch } from '@contexts/notifications/infrastructure/logging/tenant-id-mismatch-warning';
import { NotificationIngestDto } from '@contexts/notifications/transport/kafka/dtos/notification-ingest.dto';

const API_KEY_HEADER = 'x-api-key';

/**
 * Declarative inbound Kafka consumer for the notification-request topic
 * (design.md D1), registered via the kit's `MessagingModule.forRoot({
 * inboundConsumers })` in `core.module.ts` — that registration is gated on
 * `KAFKA_INGEST_ENABLED`, so this handler is only ever invoked when
 * ingestion is enabled. Thin dispatcher: authenticate, validate, then hand
 * off to `CommandBus`. Never awaits delivery.
 *
 * Authenticates via `IClientAuthenticationPort` BEFORE any body parsing or
 * DTO validation (design.md D23) — the `x-api-key` header is independent of
 * the message body, so rejecting on it first is both the cheapest and the
 * safest check. A missing, unknown, or revoked key all collapse to `null`
 * at the port (D17) and are dropped with a warning, never routed to a DLQ.
 * An infrastructure failure from the port (for example, the client store
 * being unavailable) is deliberately NOT caught here — it propagates to the
 * kit so the message is never treated as successfully processed. See
 * `src/contexts/notifications/README.md` for a documented caveat: the kit's
 * own dispatch loop (`InboundConsumerBootstrapService.dispatch()`) still
 * catches this rethrown error itself and does not stop the Kafka offset
 * from being committed — rethrowing is the closest safe behavior available
 * at this layer, and the loss window is a known, accepted limitation of the
 * current messaging kit, not a defect in this consumer.
 */
@Injectable()
export class NotificationIngestConsumer {
  private readonly logger = new Logger(NotificationIngestConsumer.name);

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(CLIENT_AUTHENTICATION_PORT)
    private readonly clientAuthenticationPort: IClientAuthenticationPort,
  ) {}

  @KafkaMessageHandler({ topic: kafkaIngestConfig().topic })
  async handleMessage(message: IInboundMessage): Promise<void> {
    const credential = message.headers[API_KEY_HEADER];
    const authenticatedClient =
      await this.clientAuthenticationPort.authenticate(credential);
    if (!authenticatedClient) {
      this.logger.warn(
        buildIngestAuthenticationRejectedWarning({
          credential,
          topic: message.topic,
          partition: message.partition,
        }),
      );
      return;
    }

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

    warnIfTenantIdMismatch(
      this.logger,
      dto.tenantId,
      authenticatedClient.tenantId,
    );

    if (dto.deliverableAddress) {
      this.logger.warn(
        `Ignoring caller-supplied deliverableAddress for tenant ${authenticatedClient.tenantId} — the Discord destination is Beacon-side config only`,
      );
    }

    if (dto.channel !== NotificationChannelEnum.DISCORD) {
      this.logger.log(
        `Skipping unsupported-for-this-change channel ${dto.channel} for tenant ${authenticatedClient.tenantId}`,
      );
      return;
    }

    await this.commandBus.execute(
      new CreateNotificationCommand({
        tenantId: authenticatedClient.tenantId,
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
