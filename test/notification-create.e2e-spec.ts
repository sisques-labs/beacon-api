import { randomUUID } from 'crypto';

import { HttpService } from '@nestjs/axios';
import { AxiosHeaders } from 'axios';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { revokeClient, seedClient } from './helpers/client-seed';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

/**
 * Creation publishes `NotificationCreatedEvent`, which enqueues an
 * asynchronous, durable delivery job (design.md, notification-delivery-decoupling).
 * This spec only asserts creation/dedupe semantics, never delivery outcome —
 * the Discord webhook call is stubbed to a fast success so background
 * delivery never makes a real network call or leaks noisy retries between
 * cases, mirroring `notification-delivery.e2e-spec.ts`.
 *
 * Phase B (design.md D21/D22): creation is now key-guarded. Every case
 * below seeds a client via `seedClient()` and presents its key with
 * `x-api-key`, matching `notification-channel-destination.e2e-spec.ts`'s
 * pattern. The request body's `tenantId` is deprecated and ignored (D22) —
 * see the dedicated "Body tenantId is ignored" describe block.
 */
const UNKNOWN_API_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

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

  describe('API key authentication', () => {
    it('rejects a missing API key with 401 (REST) and creates nothing', async () => {
      const payload = buildRestPayload();

      const res = await ctx.http().post('/api/v1/notifications').send(payload);

      expect(res.status).toBe(401);
      expect(await countRows()).toBe(0);
    });

    it('rejects an unknown API key with 401 (REST) and creates nothing', async () => {
      const payload = buildRestPayload();

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', UNKNOWN_API_KEY)
        .send(payload);

      expect(res.status).toBe(401);
      expect(await countRows()).toBe(0);
    });

    it('rejects a revoked API key with 401 (REST) and creates nothing', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);
      const payload = buildRestPayload();

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(res.status).toBe(401);
      expect(await countRows()).toBe(0);
    });

    it('rejects a missing API key with a GraphQL error and creates nothing', async () => {
      const payload = buildRestPayload();

      const res = await gql(ctx.app, CREATE_MUTATION, { input: payload });

      expect(res.body.errors).toBeDefined();
      expect(await countRows()).toBe(0);
    });
  });

  describe('Body tenantId is ignored (D22)', () => {
    it('REST: creating with a body tenantId still creates for the authenticated tenant', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload({ tenantId: randomUUID() });

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(res.status).toBe(201);
      const stored = await ctx.dataSource
        .getRepository(NotificationEntity)
        .findOneBy({ id: res.body.id });
      expect(stored?.tenantId).toBe(client.tenantId);
    });

    it('REST: creating with no body tenantId at all is accepted', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(await countRows()).toBe(1);
    });

    it('GraphQL: creating with an input tenantId still creates for the authenticated tenant', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload({ tenantId: randomUUID() });

      const res = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        {
          'x-api-key': client.apiKey,
        },
      );

      expect(res.body.errors).toBeUndefined();
      const stored = await ctx.dataSource
        .getRepository(NotificationEntity)
        .findOneBy({ id: res.body.data.notificationCreate.id as string });
      expect(stored?.tenantId).toBe(client.tenantId);
    });
  });

  describe('REST — POST /api/v1/notifications', () => {
    it('creates a notification and returns 201 + id', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(await countRows()).toBe(1);
    });

    it('is idempotent: repeating the same (tenantId, dedupeKey) creates no second row', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();

      const first = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);
      const second = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid payload (missing required field) with a 4xx and creates nothing', async () => {
      const client = await seedClient(ctx.app);
      const { title: _title, ...invalid } = buildRestPayload();

      const res = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(invalid);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await countRows()).toBe(0);
    });

    it.each(['EMAIL', 'PUSH'])(
      'rejects a %s channel (D5) with a 4xx and creates nothing',
      async (channel) => {
        const client = await seedClient(ctx.app);
        const payload = buildRestPayload({ channel });

        const res = await ctx
          .http()
          .post('/api/v1/notifications')
          .set('x-api-key', client.apiKey)
          .send(payload);

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(await countRows()).toBe(0);
      },
    );
  });

  describe('GraphQL — notificationCreate', () => {
    it('creates a notification and returns success + id', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();

      const res = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        {
          'x-api-key': client.apiKey,
        },
      );

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.notificationCreate.success).toBe(true);
      expect(res.body.data.notificationCreate.id).toEqual(expect.any(String));
      expect(await countRows()).toBe(1);
    });

    it('is idempotent: repeating the same (tenantId, dedupeKey) creates no second row', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();
      const headers = { 'x-api-key': client.apiKey };

      const first = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        headers,
      );
      const second = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        headers,
      );

      expect(second.body.errors).toBeUndefined();
      expect(second.body.data.notificationCreate.id).toBe(
        first.body.data.notificationCreate.id,
      );
      expect(await countRows()).toBe(1);
    });

    it('rejects an invalid input (missing required field) with a GraphQL error and creates nothing', async () => {
      const client = await seedClient(ctx.app);
      const { title: _title, ...invalid } = buildRestPayload();

      const res = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: invalid },
        {
          'x-api-key': client.apiKey,
        },
      );

      expect(res.body.errors).toBeDefined();
      expect(await countRows()).toBe(0);
    });

    it.each(['EMAIL', 'PUSH'])(
      'rejects a %s channel (D5) with a GraphQL error and creates nothing',
      async (channel) => {
        const client = await seedClient(ctx.app);
        const payload = buildRestPayload({ channel });

        const res = await gql(
          ctx.app,
          CREATE_MUTATION,
          { input: payload },
          {
            'x-api-key': client.apiKey,
          },
        );

        expect(res.body.errors).toBeDefined();
        expect(await countRows()).toBe(0);
      },
    );
  });

  describe('Cross-transport dedupe (same tenantId + dedupeKey pair)', () => {
    it('REST create, then GraphQL repeat: returns the original id and creates no second row', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();
      const headers = { 'x-api-key': client.apiKey };

      const restRes = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);
      const graphqlRes = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        headers,
      );

      expect(graphqlRes.body.errors).toBeUndefined();
      expect(graphqlRes.body.data.notificationCreate.id).toBe(restRes.body.id);
      expect(await countRows()).toBe(1);
    });

    it('GraphQL create, then REST repeat: returns the original id and creates no second row', async () => {
      const client = await seedClient(ctx.app);
      const payload = buildRestPayload();
      const headers = { 'x-api-key': client.apiKey };

      const graphqlRes = await gql(
        ctx.app,
        CREATE_MUTATION,
        { input: payload },
        headers,
      );
      const restRes = await ctx
        .http()
        .post('/api/v1/notifications')
        .set('x-api-key', client.apiKey)
        .send(payload);

      expect(restRes.status).toBe(201);
      expect(restRes.body.id).toBe(graphqlRes.body.data.notificationCreate.id);
      expect(await countRows()).toBe(1);
    });
  });
});
