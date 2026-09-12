import { CommandBus } from '@nestjs/cqrs';
import { IInboundMessage } from '@sisques-labs/nestjs-kit/messaging';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { NotificationIngestConsumer } from '@contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

const VALID_PAYLOAD = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  channel: 'DISCORD',
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
};

function buildInboundMessage(value: string | null): IInboundMessage {
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    key: null,
    headers: {},
    value,
  };
}

describe('NotificationIngestConsumer', () => {
  let consumer: NotificationIngestConsumer;
  let commandBus: Mocked<CommandBus>;

  beforeEach(() => {
    commandBus = {
      execute: vi.fn(),
    } as unknown as Mocked<CommandBus>;
    consumer = new NotificationIngestConsumer(commandBus);
  });

  describe('handleMessage', () => {
    it('dispatches CreateNotificationCommand for a well-formed DISCORD event', async () => {
      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD)),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock
        .calls[0][0] as CreateNotificationCommand;
      expect(dispatched).toBeInstanceOf(CreateNotificationCommand);
      expect(dispatched.dedupeKey.value).toBe(VALID_PAYLOAD.dedupeKey);
    });

    it('logs and skips without dispatching for EMAIL channel', async () => {
      await consumer.handleMessage(
        buildInboundMessage(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'EMAIL' }),
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips without dispatching for PUSH channel', async () => {
      await consumer.handleMessage(
        buildInboundMessage(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'PUSH' }),
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips a malformed event missing a required field', async () => {
      const { dedupeKey: _dedupeKey, ...withoutDedupeKey } = VALID_PAYLOAD;

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(withoutDedupeKey)),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips unparsable JSON without throwing', async () => {
      await expect(
        consumer.handleMessage(buildInboundMessage('not-json{')),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips an empty message value', async () => {
      await expect(
        consumer.handleMessage(buildInboundMessage(null)),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('ignores a caller-supplied deliverableAddress but still creates the notification', async () => {
      await consumer.handleMessage(
        buildInboundMessage(
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
