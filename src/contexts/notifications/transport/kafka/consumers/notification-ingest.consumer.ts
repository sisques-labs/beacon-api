import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { IKafkaConfig } from '@sisques-labs/nestjs-kit/messaging';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Consumer, EachMessagePayload, Kafka, SASLOptions } from 'kafkajs';

import { IKafkaIngestConfig } from '@core/config/interfaces/kafka-ingest-config.interface';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationIngestDto } from '@contexts/notifications/transport/kafka/dtos/notification-ingest.dto';

/**
 * Raw `kafkajs` consumer for the inbound notification-request topic (design.md
 * D1 — the kit's `MessagingModule` is outbound-forwarding only). Thin
 * dispatcher: validate, then hand off to `CommandBus`. Never awaits delivery.
 */
@Injectable()
export class NotificationIngestConsumer
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(NotificationIngestConsumer.name);
  private consumer: Consumer | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly commandBus: CommandBus,
  ) {}

  async onModuleInit(): Promise<void> {
    const ingestConfig =
      this.configService.getOrThrow<IKafkaIngestConfig>('kafkaIngest');

    if (!ingestConfig.enabled) {
      this.logger.log(
        'Kafka notification ingestion disabled (KAFKA_INGEST_ENABLED=false)',
      );
      return;
    }

    const kafkaConfig = this.configService.getOrThrow<IKafkaConfig>('kafka');
    const kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
      ssl: kafkaConfig.ssl,
      // The kit's `IKafkaSaslConfig` widens `mechanism` to a plain string
      // union instead of kafkajs's per-mechanism discriminated union; the
      // runtime shape is identical, so this cast is safe.
      sasl: (kafkaConfig.sasl as SASLOptions | null) ?? undefined,
    });

    this.consumer = kafka.consumer({ groupId: ingestConfig.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: ingestConfig.topic,
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });
    this.logger.log(
      `Kafka notification ingestion started on topic "${ingestConfig.topic}" (group "${ingestConfig.groupId}")`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  async handleMessage(payload: EachMessagePayload): Promise<void> {
    const raw = payload.message.value?.toString('utf-8');
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
