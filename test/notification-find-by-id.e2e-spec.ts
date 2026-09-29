import { randomUUID } from 'crypto';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { seedClient } from './helpers/client-seed';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

const UNKNOWN_API_KEY = `bcn_${'a'.repeat(16)}_${'b'.repeat(43)}`;

function buildAggregate() {
  return new NotificationBuilder()
    .withId(randomUUID())
    .withTenantId(randomUUID())
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
    // Phase B (design.md D21): NotificationController's class-level
    // @UseGuards(ClientApiKeyGuard) guards findById too, as a side effect
    // of guarding creation (task 28.2) — this endpoint's own tenant
    // scoping (D25) arrives in Phase 29, not here.
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

    it('returns the notification when it exists', async () => {
      const client = await seedClient(ctx.app);
      const aggregate = buildAggregate();
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
  });

  describe('GraphQL — notificationFindById', () => {
    const query = `
      query ($input: NotificationFindByIdRequestDto!) {
        notificationFindById(input: $input) {
          id
          status
          dedupeKey
        }
      }
    `;

    it('returns the notification when it exists', async () => {
      const aggregate = buildAggregate();
      await writeRepository.save(aggregate);

      const res = await gql(ctx.app, query, {
        input: { id: aggregate.id.value },
      });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.notificationFindById).toEqual({
        id: aggregate.id.value,
        status: 'PENDING',
        dedupeKey: aggregate.dedupeKey.value,
      });
    });

    it('returns a GraphQL error, not an unhandled crash, when the notification does not exist', async () => {
      const res = await gql(ctx.app, query, { input: { id: randomUUID() } });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.data?.notificationFindById ?? null).toBeNull();
    });
  });
});
