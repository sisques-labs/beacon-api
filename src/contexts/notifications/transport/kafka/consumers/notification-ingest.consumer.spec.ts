import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IInboundMessage } from '@sisques-labs/nestjs-kit/messaging';
import { Mocked, vi } from 'vitest';

import { CreateNotificationCommand } from '@contexts/notifications/application/commands/create-notification/create-notification.command';
import { IAuthenticatedClient } from '@contexts/notifications/application/ports/authenticated-client.interface';
import { IClientAuthenticationPort } from '@contexts/notifications/application/ports/client-authentication.port';
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

const VALID_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;
const AUTHENTICATED_CLIENT: IAuthenticatedClient = {
  clientId: 'client-1',
  tenantId: '33333333-3333-4333-8333-333333333333',
};

function buildInboundMessage(
  value: string | null,
  headers: Record<string, string> = {},
): IInboundMessage {
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    key: null,
    headers,
    value,
  };
}

describe('NotificationIngestConsumer', () => {
  let consumer: NotificationIngestConsumer;
  let commandBus: Mocked<CommandBus>;
  let clientAuthenticationPort: Mocked<IClientAuthenticationPort>;

  beforeEach(() => {
    commandBus = {
      execute: vi.fn(),
    } as unknown as Mocked<CommandBus>;
    clientAuthenticationPort = {
      authenticate: vi.fn(),
    } as unknown as Mocked<IClientAuthenticationPort>;
    consumer = new NotificationIngestConsumer(
      commandBus,
      clientAuthenticationPort,
    );
  });

  describe('handleMessage', () => {
    it('dispatches CreateNotificationCommand for a well-formed DISCORD event with a valid key', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(clientAuthenticationPort.authenticate).toHaveBeenCalledWith(
        VALID_KEY,
      );
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock
        .calls[0][0] as CreateNotificationCommand;
      expect(dispatched).toBeInstanceOf(CreateNotificationCommand);
      expect(dispatched.dedupeKey.value).toBe(VALID_PAYLOAD.dedupeKey);
    });

    it('derives the persistence tenant from the authenticated client, never the body tenantId', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      const dispatched = commandBus.execute.mock
        .calls[0][0] as CreateNotificationCommand;
      expect(dispatched.tenantId.value).toBe(AUTHENTICATED_CLIENT.tenantId);
    });

    it('accepts an event with no body tenantId at all, using the authenticated tenant', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );
      const { tenantId: _tenantId, ...withoutTenantId } = VALID_PAYLOAD;

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(withoutTenantId), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const dispatched = commandBus.execute.mock
        .calls[0][0] as CreateNotificationCommand;
      expect(dispatched.tenantId.value).toBe(AUTHENTICATED_CLIENT.tenantId);
    });

    it('warns on a mismatched body tenantId but still creates for the authenticated tenant', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toContain(VALID_PAYLOAD.tenantId);
      expect(message).toContain(AUTHENTICATED_CLIENT.tenantId);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('logs and skips without dispatching for EMAIL channel', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await consumer.handleMessage(
        buildInboundMessage(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'EMAIL' }),
          { 'x-api-key': VALID_KEY },
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips without dispatching for PUSH channel', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await consumer.handleMessage(
        buildInboundMessage(
          JSON.stringify({ ...VALID_PAYLOAD, channel: 'PUSH' }),
          { 'x-api-key': VALID_KEY },
        ),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips a malformed event missing a required field', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );
      const { dedupeKey: _dedupeKey, ...withoutDedupeKey } = VALID_PAYLOAD;

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(withoutDedupeKey), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips unparsable JSON without throwing', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await expect(
        consumer.handleMessage(
          buildInboundMessage('not-json{', { 'x-api-key': VALID_KEY }),
        ),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('logs and skips an empty message value', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await expect(
        consumer.handleMessage(
          buildInboundMessage(null, { 'x-api-key': VALID_KEY }),
        ),
      ).resolves.toBeUndefined();

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('ignores a caller-supplied deliverableAddress but still creates the notification', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(
        AUTHENTICATED_CLIENT,
      );

      await consumer.handleMessage(
        buildInboundMessage(
          JSON.stringify({
            ...VALID_PAYLOAD,
            deliverableAddress: 'https://evil.example.com/webhook',
          }),
          { 'x-api-key': VALID_KEY },
        ),
      );

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('authenticates via the port BEFORE parsing or validating the message body', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await consumer.handleMessage(buildInboundMessage('not-json{'));

      expect(clientAuthenticationPort.authenticate).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('drops the message and warns without dispatching when no x-api-key header is presented', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD)),
      );

      expect(clientAuthenticationPort.authenticate).toHaveBeenCalledWith(
        undefined,
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toContain('missing');

      warnSpy.mockRestore();
    });

    it('drops the message and warns without dispatching for an unknown x-api-key', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toContain('invalid or revoked');

      warnSpy.mockRestore();
    });

    it('drops the message and warns without dispatching for a revoked x-api-key', async () => {
      clientAuthenticationPort.authenticate.mockResolvedValue(null);
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      expect(commandBus.execute).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('rethrows an infrastructure error from the authentication port instead of dropping silently', async () => {
      const infraError = new Error('client-resolution data store unavailable');
      clientAuthenticationPort.authenticate.mockRejectedValue(infraError);

      await expect(
        consumer.handleMessage(
          buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
            'x-api-key': VALID_KEY,
          }),
        ),
      ).rejects.toThrow(infraError);

      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('never logs the presented API key on any authentication path', async () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const errorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      clientAuthenticationPort.authenticate.mockResolvedValueOnce(
        AUTHENTICATED_CLIENT,
      );
      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      clientAuthenticationPort.authenticate.mockResolvedValueOnce(null);
      await consumer.handleMessage(
        buildInboundMessage(JSON.stringify(VALID_PAYLOAD), {
          'x-api-key': VALID_KEY,
        }),
      );

      const loggedCalls = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat();
      for (const call of loggedCalls) {
        const serialized =
          typeof call === 'string' ? call : JSON.stringify(call);
        expect(serialized).not.toContain(VALID_KEY);
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
