import { randomUUID } from 'crypto';

import type { EachMessagePayload } from 'kafkajs';
import { vi } from 'vitest';

import { NotificationAggregate } from '../src/contexts/notifications/domain/aggregates/notification.aggregate';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '../src/contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationIngestConsumer } from '../src/contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';

function buildPayload(value: Record<string, unknown>): EachMessagePayload {
  const raw = Buffer.from(JSON.stringify(value));
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

/**
 * Delivery is dispatched asynchronously off `NotificationCreatedEvent` (see
 * design.md D2) — ingestion never awaits it. Poll for the terminal status
 * instead of asserting immediately after `handleMessage` resolves.
 */
async function waitForTerminalStatus(
  writeRepository: INotificationWriteRepository,
  tenantId: string,
  dedupeKey: string,
  timeoutMs = 3000,
): Promise<NotificationAggregate> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const notification = await writeRepository.findByDedupeKey(
      tenantId,
      dedupeKey,
    );
    if (notification && notification.status.value !== 'PENDING') {
      return notification;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for notification (${tenantId}, ${dedupeKey}) to leave PENDING`,
  );
}

describe('Notification Discord delivery (e2e)', () => {
  let ctx: E2EContext;
  let writeRepository: INotificationWriteRepository;
  let consumer: NotificationIngestConsumer;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

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
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('delivers to Discord and transitions to SENT on a 2xx webhook response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 204 }) as unknown as Response,
    );
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('SENT');
    expect(delivered.sentAt).not.toBeNull();
    expect(delivered.failureReason).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('transitions to FAILED with a failureReason when the webhook responds non-2xx, and never retries', async () => {
    fetchSpy.mockResolvedValue(
      new Response(null, { status: 500 }) as unknown as Response,
    );
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('FAILED');
    expect(delivered.failureReason?.value).toContain('500');
    expect(delivered.sentAt).toBeNull();
    // Give any accidental retry a chance to fire before asserting call count.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('transitions to FAILED with a failureReason on a webhook network error', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const event = buildValidEvent();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('FAILED');
    expect(delivered.failureReason?.value).toBe('ECONNREFUSED');
  });
});
