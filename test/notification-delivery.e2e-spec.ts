import { randomUUID } from 'crypto';

import { HttpService } from '@nestjs/axios';
import { IInboundMessage } from '@sisques-labs/nestjs-kit/messaging';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { notificationDeliveryQueueConfig } from '../src/contexts/notifications/infrastructure/config/notification-delivery-queue.config';
import { NotificationAggregate } from '../src/contexts/notifications/domain/aggregates/notification.aggregate';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '../src/contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationIngestConsumer } from '../src/contexts/notifications/transport/kafka/consumers/notification-ingest.consumer';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';

function buildPayload(value: Record<string, unknown>): IInboundMessage {
  return {
    topic: 'beacon-api.notification-requests',
    partition: 0,
    key: null,
    headers: {},
    value: JSON.stringify(value),
  };
}

function buildAxiosError(status: number): AxiosError {
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: null,
    },
  );
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
  let httpService: HttpService;
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ctx = await createE2EApp();
    writeRepository = ctx.app.get(NOTIFICATION_WRITE_REPOSITORY);
    consumer = ctx.app.get(NotificationIngestConsumer);
    httpService = ctx.app.get(HttpService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
    postSpy = vi.spyOn(httpService, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('delivers to Discord and transitions to SENT on a 2xx webhook response', async () => {
    postSpy.mockReturnValue(
      of({
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
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
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('retries until exhaustion then transitions to FAILED with a failureReason', async () => {
    postSpy.mockReturnValue(throwError(() => buildAxiosError(500)));
    const event = buildValidEvent();
    const { attempts } = notificationDeliveryQueueConfig();

    await consumer.handleMessage(buildPayload(event));
    const delivered = await waitForTerminalStatus(
      writeRepository,
      event.tenantId,
      event.dedupeKey,
    );

    expect(delivered.status.value).toBe('FAILED');
    expect(delivered.failureReason?.value).toContain('500');
    expect(delivered.sentAt).toBeNull();
    // Only the final BullMQ attempt persists FAILED (design.md D4), so by
    // the time the aggregate leaves PENDING every retry has already fired:
    // exactly `attempts` webhook calls (design.md D3/D9 test-profile
    // backoff). Retry-then-succeed and crash-recovery scenarios are covered
    // by PR #14's e2e rework.
    expect(postSpy).toHaveBeenCalledTimes(attempts);
  });

  it('transitions to FAILED with a failureReason on a webhook network error', async () => {
    postSpy.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
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
