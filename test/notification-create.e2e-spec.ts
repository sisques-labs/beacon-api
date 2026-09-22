import { randomUUID } from 'crypto';

import { HttpService } from '@nestjs/axios';
import { AxiosHeaders } from 'axios';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

/**
 * Creation publishes `NotificationCreatedEvent`, which enqueues an
 * asynchronous, durable delivery job (design.md, notification-delivery-decoupling).
 * This spec only asserts creation/dedupe semantics, never delivery outcome —
 * the Discord webhook call is stubbed to a fast success so background
 * delivery never makes a real network call or leaks noisy retries between
 * cases, mirroring `notification-delivery.e2e-spec.ts`.
 */
function buildSuccessResponse() {
  return of({
    data: null,
    status: 204,
    statusText: 'No Content',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function buildRestPayload(overrides: Record<string, unknown> = {}) {
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

const CREATE_MUTATION = `
  mutation ($input: NotificationCreateRequestDto!) {
    notificationCreate(input: $input) {
      success
      id
      message
    }
  }
`;

describe('Notification creation (e2e)', () => {
  let ctx: E2EContext;
  let httpService: HttpService;
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    ctx = await createE2EApp();
    httpService = ctx.app.get(HttpService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
    postSpy = vi
      .spyOn(httpService, 'post')
      .mockReturnValue(buildSuccessResponse());
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  async function countRows(): Promise<number> {
    return ctx.dataSource.getRepository(NotificationEntity).count();
  }

  describe('REST — POST /api/v1/notifications', () => {
    it('creates a notification and returns 201 + id', async () => {
      const payload = buildRestPayload();

      const res = await ctx.http().post('/api/v1/notifications').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(await countRows()).toBe(1);
    });

    it('is idempotent: repeating the same (tenantId, dedupeKey) creates no second row', async () => {
      const payload = buildRestPayload();

      const first = await ctx
        .http()
        .post('/api/v1/notifications')
        .send(payload);
      const second = await ctx
        .http()
        .post('/api/v1/notifications')
        .send(payload);

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid payload (missing required field) with a 4xx and creates nothing', async () => {
      const { title: _title, ...invalid } = buildRestPayload();

      const res = await ctx.http().post('/api/v1/notifications').send(invalid);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await countRows()).toBe(0);
    });

    it.each(['EMAIL', 'PUSH'])(
      'rejects a %s channel (D5) with a 4xx and creates nothing',
      async (channel) => {
        const payload = buildRestPayload({ channel });

        const res = await ctx
          .http()
          .post('/api/v1/notifications')
          .send(payload);

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(await countRows()).toBe(0);
      },
    );

    it('creates a RECORD_ONLY notification and returns 201 + id', async () => {
      const payload = buildRestPayload({ deliveryMode: 'RECORD_ONLY' });

      const res = await ctx.http().post('/api/v1/notifications').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid deliveryMode (SSRF constraint D3) with a 4xx and creates nothing', async () => {
      const payload = buildRestPayload({
        deliveryMode: 'https://evil.example.com/webhook',
      });

      const res = await ctx.http().post('/api/v1/notifications').send(payload);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await countRows()).toBe(0);
    });
  });

  describe('GraphQL — notificationCreate', () => {
    it('creates a notification and returns success + id', async () => {
      const payload = buildRestPayload();

      const res = await gql(ctx.app, CREATE_MUTATION, { input: payload });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.notificationCreate.success).toBe(true);
      expect(res.body.data.notificationCreate.id).toEqual(expect.any(String));
      expect(await countRows()).toBe(1);
    });

    it('is idempotent: repeating the same (tenantId, dedupeKey) creates no second row', async () => {
      const payload = buildRestPayload();

      const first = await gql(ctx.app, CREATE_MUTATION, { input: payload });
      const second = await gql(ctx.app, CREATE_MUTATION, { input: payload });

      expect(second.body.errors).toBeUndefined();
      expect(second.body.data.notificationCreate.id).toBe(
        first.body.data.notificationCreate.id,
      );
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid input (missing required field) with a GraphQL error and creates nothing', async () => {
      const { title: _title, ...invalid } = buildRestPayload();

      const res = await gql(ctx.app, CREATE_MUTATION, { input: invalid });

      expect(res.body.errors).toBeDefined();
      expect(await countRows()).toBe(0);
    });

    it.each(['EMAIL', 'PUSH'])(
      'rejects a %s channel (D5) with a GraphQL error and creates nothing',
      async (channel) => {
        const payload = buildRestPayload({ channel });

        const res = await gql(ctx.app, CREATE_MUTATION, { input: payload });

        expect(res.body.errors).toBeDefined();
        expect(await countRows()).toBe(0);
      },
    );

    it('creates a RECORD_ONLY notification and returns success + id', async () => {
      const payload = buildRestPayload({ deliveryMode: 'RECORD_ONLY' });

      const res = await gql(ctx.app, CREATE_MUTATION, { input: payload });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.notificationCreate.success).toBe(true);
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid deliveryMode (SSRF constraint D3) with a GraphQL error and creates nothing', async () => {
      const payload = buildRestPayload({
        deliveryMode: 'https://evil.example.com/webhook',
      });

      const res = await gql(ctx.app, CREATE_MUTATION, { input: payload });

      expect(res.body.errors).toBeDefined();
      expect(await countRows()).toBe(0);
    });
  });

  describe('Cross-transport dedupe (same tenantId + dedupeKey pair)', () => {
    it('REST create, then GraphQL repeat: returns the original id and creates no second row', async () => {
      const payload = buildRestPayload();

      const restRes = await ctx
        .http()
        .post('/api/v1/notifications')
        .send(payload);
      const graphqlRes = await gql(ctx.app, CREATE_MUTATION, {
        input: payload,
      });

      expect(graphqlRes.body.errors).toBeUndefined();
      expect(graphqlRes.body.data.notificationCreate.id).toBe(restRes.body.id);
      expect(await countRows()).toBe(1);
    });

    it('GraphQL create, then REST repeat: returns the original id and creates no second row', async () => {
      const payload = buildRestPayload();

      const graphqlRes = await gql(ctx.app, CREATE_MUTATION, {
        input: payload,
      });
      const restRes = await ctx
        .http()
        .post('/api/v1/notifications')
        .send(payload);

      expect(restRes.status).toBe(201);
      expect(restRes.body.id).toBe(graphqlRes.body.data.notificationCreate.id);
      expect(await countRows()).toBe(1);
    });
  });
});
