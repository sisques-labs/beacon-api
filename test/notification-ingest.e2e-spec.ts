import { randomUUID } from 'crypto';

import type { EachMessagePayload } from 'kafkajs';

import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '../src/contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationEntity } from '../src/contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationIngestConsumer } from '../src/contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';

function buildPayload(
  value: Record<string, unknown> | null,
): EachMessagePayload {
  const raw = value === null ? null : Buffer.from(JSON.stringify(value));
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    message: {
      key: null,
      value: raw,
      timestamp: '0',
      attributes: 0,
      offset: '0',
      headers: {},
    } as unknown as EachMessagePayload['message'],
    heartbeat: async () => undefined,
    pause: () => () => undefined,
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

  it('persists a new PENDING notification for a valid DISCORD event', async () => {
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));

    const persisted = await writeRepository.findByDedupeKey(
      event.tenantId,
      event.dedupeKey,
    );
    expect(persisted).not.toBeNull();
    expect(persisted?.status.value).toBe('PENDING');
    expect(persisted?.title.value).toBe(event.title);
  });

  it('is idempotent: republishing the same (tenantId, dedupeKey) creates no second notification', async () => {
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const firstMatch = await writeRepository.findByDedupeKey(
      event.tenantId,
      event.dedupeKey,
    );

    await consumer.handleMessage(buildPayload(event));
    const secondMatch = await writeRepository.findByDedupeKey(
      event.tenantId,
      event.dedupeKey,
    );

    expect(secondMatch?.id.value).toBe(firstMatch?.id.value);
  });

  it.each(['EMAIL', 'PUSH'])(
    'skips a %s event without creating any notification row',
    async (channel) => {
      const event = buildValidEvent({ channel });

      await consumer.handleMessage(buildPayload(event));

      const count = await ctx.dataSource
        .getRepository(NotificationEntity)
        .count();
      expect(count).toBe(0);
    },
  );

  it('skips a malformed event (missing required field) without creating any notification row', async () => {
    const { dedupeKey: _dedupeKey, ...malformed } = buildValidEvent();

    await consumer.handleMessage(buildPayload(malformed));

    const count = await ctx.dataSource
      .getRepository(NotificationEntity)
      .count();
    expect(count).toBe(0);
  });

  it('persists exactly one row per distinct dedupeKey, proving idempotency operates on real state', async () => {
    const first = buildValidEvent();
    const second = buildValidEvent();

    await consumer.handleMessage(buildPayload(first));
    await consumer.handleMessage(buildPayload(first));
    await consumer.handleMessage(buildPayload(second));

    const count = await ctx.dataSource
      .getRepository(NotificationEntity)
      .count();
    expect(count).toBe(2);
  });
});
