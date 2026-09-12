import { randomUUID } from 'crypto';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

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
    it('returns the notification when it exists', async () => {
      const aggregate = buildAggregate();
      await writeRepository.save(aggregate);

      const res = await ctx
        .http()
        .get(`/api/v1/notifications/${aggregate.id.value}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(aggregate.id.value);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.dedupeKey).toBe(aggregate.dedupeKey.value);
    });

    it('returns 404 when the notification does not exist', async () => {
      const res = await ctx.http().get(`/api/v1/notifications/${randomUUID()}`);

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
