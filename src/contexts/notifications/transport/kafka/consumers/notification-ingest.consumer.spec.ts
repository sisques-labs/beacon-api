import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Mocked, vi } from 'vitest';
import type { EachMessagePayload } from 'kafkajs';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationIngestConsumer } from '@contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

const { mockConsumer, mockKafkaConstructor } = vi.hoisted(() => {
  const consumer = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockConsumer: consumer,
    mockKafkaConstructor: vi.fn().mockImplementation(function MockKafka() {
      return { consumer: vi.fn(() => consumer) };
    }),
  };
});

vi.mock('kafkajs', async () => {
  const actual = await vi.importActual<typeof import('kafkajs')>('kafkajs');
  return {
    ...actual,
    Kafka: mockKafkaConstructor,
  };
});

const KAFKA_INGEST_CONFIG = {
  enabled: true,
  topic: 'beacon-api.notification-requests',
  groupId: 'beacon-api-notification-ingest',
};

const KAFKA_CONFIG = {
  enabled: false,
  clientId: 'beacon-api',
  brokers: ['localhost:9092'],
  topicPrefix: 'beacon-api',
  ssl: false,
  sasl: null,
};

const VALID_PAYLOAD = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  channel: 'DISCORD',
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
};

function buildEachMessagePayload(value: string | null): EachMessagePayload {
  return {
    topic: KAFKA_INGEST_CONFIG.topic,
    partition: 0,
    message: {
      key: null,
      value: value === null ? null : Buffer.from(value),
      timestamp: '0',
      attributes: 0,
      offset: '0',
      headers: {},
    } as unknown as EachMessagePayload['message'],
    heartbeat: vi.fn(),
    pause: vi.fn(),
  };
}

describe('NotificationIngestConsumer', () => {
  let consumer: NotificationIngestConsumer;
  let configService: Mocked<ConfigService>;
  let commandBus: Mocked<CommandBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'kafkaIngest') return KAFKA_INGEST_CONFIG;
        if (key === 'kafka') return KAFKA_CONFIG;
        throw new Error(`Unexpected config key ${key}`);
      }),
    } as unknown as Mocked<ConfigService>;
    commandBus = {
      execute: vi.fn(),
    } as unknown as Mocked<CommandBus>;
    consumer = new NotificationIngestConsumer(configService, commandBus);
  });

  describe('onModuleInit', () => {
    it('does not connect to Kafka when ingestion is disabled', async () => {
      configService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'kafkaIngest')
          return { ...KAFKA_INGEST_CONFIG, enabled: false };
        return KAFKA_CONFIG;
      });

      await consumer.onModuleInit();

      expect(mockKafkaConstructor).not.toHaveBeenCalled();
      expect(mockConsumer.connect).not.toHaveBeenCalled();
    });

    it('connects, subscribes, and runs the consumer when ingestion is enabled', async () => {
      await consumer.onModuleInit();

      expect(mockKafkaConstructor).toHaveBeenCalledWith(
        expect.objectContaining({ brokers: KAFKA_CONFIG.brokers }),
      );
      expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: KAFKA_INGEST_CONFIG.topic,
        fromBeginning: false,
      });
      expect(mockConsumer.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('onApplicationShutdown', () => {
    it('disconnects the consumer when one was started', async () => {
      await consumer.onModuleInit();

      await consumer.onApplicationShutdown();

      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the consumer was never started', async () => {
      await expect(consumer.onApplicationShutdown()).resolves.toBeUndefined();

      expect(mockConsumer.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('dispatches CreateNotificationCommand for a well-formed DISCORD event', async () => {
      await consumer.handleMessage(
        buildEachMessagePayload(JSON.stringify(VALID_PAYLOAD)),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock
        .calls[0][0] as CreateNotificationCommand;
      expect(dispatched).toBeInstanceOf(CreateNotificationCommand);
      expect(dispatched.dedupeKey.value).toBe(VALID_PAYLOAD.dedupeKey);
    });

    it('logs and skips without dispatching for EMAIL channel', async () => {
      await consumer.handleMessage(
        buildEachMessagePayload(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'EMAIL' }),
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips without dispatching for PUSH channel', async () => {
      await consumer.handleMessage(
        buildEachMessagePayload(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'PUSH' }),
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips a malformed event missing a required field', async () => {
      const { dedupeKey: _dedupeKey, ...withoutDedupeKey } = VALID_PAYLOAD;

      await consumer.handleMessage(
        buildEachMessagePayload(JSON.stringify(withoutDedupeKey)),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips unparsable JSON without throwing', async () => {
      await expect(
        consumer.handleMessage(buildEachMessagePayload('not-json{')),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips an empty message value', async () => {
      await expect(
        consumer.handleMessage(buildEachMessagePayload(null)),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('ignores a caller-supplied deliverableAddress but still creates the notification', async () => {
      await consumer.handleMessage(
        buildEachMessagePayload(
          JSON.stringify({
            ...VALID_PAYLOAD,
            deliverableAddress: 'https://evil.example.com/webhook',
          }),
        ),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
