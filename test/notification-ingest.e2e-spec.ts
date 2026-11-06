import { randomUUID } from 'crypto';

import { IInboundMessage } from '@sisques-labs/nestjs-kit/messaging';
import { vi } from 'vitest';

import {
  CLIENT_AUTHENTICATION_PORT,
  IClientAuthenticationPort,
} from '../src/contexts/notifications/application/ports/client-authentication.port';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '../src/contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationEntity } from '../src/contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationIngestConsumer } from '../src/contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { revokeClient, seedClient } from './helpers/client-seed';
import { truncateAll } from './helpers/db-reset';

const UNKNOWN_API_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

function buildPayload(
  value: Record<string, unknown> | null,
  headers: Record<string, string> = {},
): IInboundMessage {
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    key: null,
    headers,
    value: value === null ? null : JSON.stringify(value),
  };
}

function buildValidEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: randomUUID(),
    recipientUserId: randomUUID(),
    channel: 'DISCORD',
    title: 'Plant watered',
    body: 'Your plant was watered successfully.',
    sourceService: 'gardenia-api',
    dedupeKey: `gardenia:plant:${randomUUID()}:watered`,
    ...overrides,
  };
}

describe('Notification Kafka ingestion (e2e)', () => {
  let ctx: E2EContext;
  let writeRepository: INotificationWriteRepository;
  let consumer: NotificationIngestConsumer;

  beforeAll(async () => {
    ctx = await createE2EApp();
    writeRepository = ctx.app.get(NOTIFICATION_WRITE_REPOSITORY);
    consumer = ctx.app.get(NotificationIngestConsumer);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  it('persists a new PENDING notification for a valid DISCORD event authenticated with a valid key', async () => {
    const client = await seedClient(ctx.app);
    const event = buildValidEvent({ tenantId: client.tenantId });

    await consumer.handleMessage(
      buildPayload(event, { 'x-api-key': client.apiKey }),
    );

    const persisted = await writeRepository.findByDedupeKey(
      client.tenantId,
      event.dedupeKey,
    );
    expect(persisted).not.toBeNull();
    expect(persisted?.status.value).toBe('PENDING');
    expect(persisted?.title.value).toBe(event.title);
  });

  it('is idempotent: republishing the same (tenantId, dedupeKey) creates no second notification', async () => {
    const client = await seedClient(ctx.app);
    const event = buildValidEvent({ tenantId: client.tenantId });
    const headers = { 'x-api-key': client.apiKey };

    await consumer.handleMessage(buildPayload(event, headers));
    const firstMatch = await writeRepository.findByDedupeKey(
      client.tenantId,
      event.dedupeKey,
    );

    await consumer.handleMessage(buildPayload(event, headers));
    const secondMatch = await writeRepository.findByDedupeKey(
      client.tenantId,
      event.dedupeKey,
    );

    expect(secondMatch?.id.value).toBe(firstMatch?.id.value);
  });

  it.each(['EMAIL', 'PUSH'])(
    'skips a %s event without creating any notification row',
    async (channel) => {
      const client = await seedClient(ctx.app);
      const event = buildValidEvent({ tenantId: client.tenantId, channel });

      await consumer.handleMessage(
        buildPayload(event, { 'x-api-key': client.apiKey }),
      );

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);
    },
  );

  it('skips a malformed event (missing required field) without creating any notification row', async () => {
    const client = await seedClient(ctx.app);
    const { dedupeKey: _dedupeKey, ...malformed } = buildValidEvent({
      tenantId: client.tenantId,
    });

    await consumer.handleMessage(
      buildPayload(malformed, { 'x-api-key': client.apiKey }),
    );

    const count = await ctx.dataSource
      .getRepository(NotificationEntity)
      .count();
    expect(count).toBe(0);
  });

  it('persists exactly one row per distinct dedupeKey, proving idempotency operates on real state', async () => {
    const client = await seedClient(ctx.app);
    const headers = { 'x-api-key': client.apiKey };
    const first = buildValidEvent({ tenantId: client.tenantId });
    const second = buildValidEvent({ tenantId: client.tenantId });

    await consumer.handleMessage(buildPayload(first, headers));
    await consumer.handleMessage(buildPayload(first, headers));
    await consumer.handleMessage(buildPayload(second, headers));

    const count = await ctx.dataSource
      .getRepository(NotificationEntity)
      .count();
    expect(count).toBe(2);
  });

  /**
   * design.md D23 — Kafka message API key authentication. Every rejection
   * reason drops the message (no persistence, no DLQ), and an
   * infrastructure failure from the port is rethrown, never swallowed.
   */
  describe('API key authentication (design.md D23)', () => {
    it('drops the message and persists nothing when no x-api-key header is presented', async () => {
      const event = buildValidEvent();

      await consumer.handleMessage(buildPayload(event));

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);
    });

    it('drops the message and persists nothing for an unknown x-api-key', async () => {
      const event = buildValidEvent();

      await consumer.handleMessage(
        buildPayload(event, { 'x-api-key': UNKNOWN_API_KEY }),
      );

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);
    });

    it('drops the message and persists nothing for a revoked x-api-key', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);
      const event = buildValidEvent({ tenantId: client.tenantId });

      await consumer.handleMessage(
        buildPayload(event, { 'x-api-key': client.apiKey }),
      );

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);
    });

    it('persists for the authenticated tenant even when the body tenantId points elsewhere (D22)', async () => {
      const client = await seedClient(ctx.app);
      const otherTenantId = randomUUID();
      const event = buildValidEvent({ tenantId: otherTenantId });

      await consumer.handleMessage(
        buildPayload(event, { 'x-api-key': client.apiKey }),
      );

      const persisted = await writeRepository.findByDedupeKey(
        client.tenantId,
        event.dedupeKey,
      );
      expect(persisted).not.toBeNull();

      const mismatchedTenantMatch = await writeRepository.findByDedupeKey(
        otherTenantId,
        event.dedupeKey,
      );
      expect(mismatchedTenantMatch).toBeNull();
    });

    it('accepts an event with no body tenantId at all, persisting for the authenticated tenant', async () => {
      const client = await seedClient(ctx.app);
      const { tenantId: _tenantId, ...withoutTenantId } = buildValidEvent();

      await consumer.handleMessage(
        buildPayload(withoutTenantId, { 'x-api-key': client.apiKey }),
      );

      const persisted = await writeRepository.findByDedupeKey(
        client.tenantId,
        withoutTenantId.dedupeKey,
      );
      expect(persisted).not.toBeNull();
    });

    it('rethrows an infrastructure error from authentication instead of dropping silently, and persists nothing', async () => {
      const clientAuthenticationPort = ctx.app.get<IClientAuthenticationPort>(
        CLIENT_AUTHENTICATION_PORT,
      );
      const authenticateSpy = vi
        .spyOn(clientAuthenticationPort, 'authenticate')
        .mockRejectedValueOnce(
          new Error('client-resolution data store unavailable'),
        );
      const event = buildValidEvent();

      await expect(
        consumer.handleMessage(
          buildPayload(event, { 'x-api-key': UNKNOWN_API_KEY }),
        ),
      ).rejects.toThrow('client-resolution data store unavailable');

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);

      authenticateSpy.mockRestore();
    });
  });
});
