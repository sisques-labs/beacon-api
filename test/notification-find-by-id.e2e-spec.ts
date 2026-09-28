import { randomUUID } from 'crypto';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { revokeClient, seedClient } from './helpers/client-seed';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

const UNKNOWN_API_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

function buildAggregate(overrides: { tenantId?: string } = {}) {
  return new NotificationBuilder()
    .withId(randomUUID())
    .withTenantId(overrides.tenantId ?? randomUUID())
    .withRecipientUserId(randomUUID())
    .withChannel('DISCORD')
    .withTitle('Title')
    .withBody('Body')
    .withSourceService('gardenia')
    .withDedupeKey(randomUUID())
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('Notification get-by-id (e2e)', () => {
  let ctx: E2EContext;
  let writeRepository: INotificationWriteRepository;

  beforeAll(async () => {
    ctx = await createE2EApp();
    writeRepository = ctx.app.get(NOTIFICATION_WRITE_REPOSITORY);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.dataSource);
  });

  describe('REST — GET /api/v1/notifications/:id', () => {
    // Phase B (design.md D21/D25): NotificationController's class-level
    // @UseGuards(ClientApiKeyGuard) guards findById too, as a side effect
    // of guarding creation (task 28.2). The read is also tenant-scoped
    // (D25, task 29.2/29.3): another tenant's notification is 404, never
    // 403.
    it('rejects a missing API key with 401', async () => {
      const aggregate = buildAggregate();
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`);

      expect(res.status).toBe(401);
    });

    it('rejects an unknown API key with 401', async () => {
      const aggregate = buildAggregate();
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`)
        .set('x-api-key', UNKNOWN_API_KEY);

      expect(res.status).toBe(401);
    });

    it('rejects a revoked API key with 401', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);
      const aggregate = buildAggregate({ tenantId: client.tenantId });
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`)
        .set('x-api-key', client.apiKey);

      expect(res.status).toBe(401);
    });

    it('returns the notification when it exists for the authenticated tenant', async () => {
      const client = await seedClient(ctx.app);
      const aggregate = buildAggregate({ tenantId: client.tenantId });
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`)
        .set('x-api-key', client.apiKey);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(aggregate.id.value);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.dedupeKey).toBe(aggregate.dedupeKey.value);
    });

    it('returns 404 when the notification does not exist', async () => {
      const client = await seedClient(ctx.app);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${randomUUID()}`)
        .set('x-api-key', client.apiKey);

      expect(res.status).toBe(404);
    });

    it("returns 404, never 403, for another tenant's notification (D25)", async () => {
      const owner = await seedClient(ctx.app);
      const other = await seedClient(ctx.app);
      const aggregate = buildAggregate({ tenantId: owner.tenantId });
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`)
        .set('x-api-key', other.apiKey);

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
    });

    it('returns a nonexistent id and a cross-tenant id as the same, indistinguishable 404 body (D25)', async () => {
      const owner = await seedClient(ctx.app);
      const other = await seedClient(ctx.app);
      const aggregate = buildAggregate({ tenantId: owner.tenantId });
      await writeRepository.save(aggregate);

      const crossTenantRes = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`)
        .set('x-api-key', other.apiKey);
      const nonexistentRes = await ctx
        .http()
        .get(`/api/v1/notifications/${randomUUID()}`)
        .set('x-api-key', other.apiKey);

      expect(crossTenantRes.status).toBe(404);
      expect(nonexistentRes.status).toBe(404);
      expect(crossTenantRes.body.error).toBe(nonexistentRes.body.error);
    });
  });

  describe('GraphQL — notificationFindById', () => {
    // Phase B (design.md D21/D25, task 29.3): the resolver gained
    // @UseGuards(ClientApiKeyGuard) — every case below now requires a
    // valid, unrevoked key, and the read is tenant-scoped the same way as
    // the REST endpoint above.
    const query = `
      query ($input: NotificationFindByIdRequestDto!) {
        notificationFindById(input: $input) {
          id
          status
          dedupeKey
        }
      }
    `;

    it('rejects a missing API key with a GraphQL 401 error', async () => {
      const res = await gql(ctx.app, query, { input: { id: randomUUID() } });

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('rejects an unknown API key with a GraphQL 401 error', async () => {
      const res = await gql(
        ctx.app,
        query,
        { input: { id: randomUUID() } },
        { 'x-api-key': UNKNOWN_API_KEY },
      );

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('rejects a revoked API key with a GraphQL 401 error', async () => {
      const client = await seedClient(ctx.app);
      await revokeClient(ctx.app, client.id);

      const res = await gql(
        ctx.app,
        query,
        { input: { id: randomUUID() } },
        { 'x-api-key': client.apiKey },
      );

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].extensions?.originalError?.statusCode).toBe(
        401,
      );
    });

    it('returns the notification when it exists for the authenticated tenant', async () => {
      const client = await seedClient(ctx.app);
      const aggregate = buildAggregate({ tenantId: client.tenantId });
      await writeRepository.save(aggregate);

      const res = await gql(
        ctx.app,
        query,
        { input: { id: aggregate.id.value } },
        { 'x-api-key': client.apiKey },
      );

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.notificationFindById).toEqual({
        id: aggregate.id.value,
        status: 'PENDING',
        dedupeKey: aggregate.dedupeKey.value,
      });
    });

    it('returns a GraphQL error, not an unhandled crash, when the notification does not exist', async () => {
      const client = await seedClient(ctx.app);

      const res = await gql(
        ctx.app,
        query,
        { input: { id: randomUUID() } },
        { 'x-api-key': client.apiKey },
      );

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.data?.notificationFindById ?? null).toBeNull();
    });

    it("returns the same not-found GraphQL error for another tenant's notification as for a nonexistent id, never a 403 (D25)", async () => {
      const owner = await seedClient(ctx.app);
      const other = await seedClient(ctx.app);
      const aggregate = buildAggregate({ tenantId: owner.tenantId });
      await writeRepository.save(aggregate);

      const crossTenantRes = await gql(
        ctx.app,
        query,
        { input: { id: aggregate.id.value } },
        { 'x-api-key': other.apiKey },
      );
      const nonexistentRes = await gql(
        ctx.app,
        query,
        { input: { id: randomUUID() } },
        { 'x-api-key': other.apiKey },
      );

      expect(crossTenantRes.body.data?.notificationFindById ?? null).toBeNull();
      expect(crossTenantRes.body.errors[0].extensions?.statusCode).toBe(404);
      expect(crossTenantRes.body.errors[0].extensions?.statusCode).not.toBe(
        403,
      );
      expect(nonexistentRes.body.errors[0].extensions?.statusCode).toBe(404);
    });
  });
});
