import { randomUUID } from 'crypto';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';

import { createE2EApp, E2EContext } from './helpers/app-bootstrap';
import { truncateAll } from './helpers/db-reset';
import { gql } from './helpers/graphql-client';

function buildAggregate(overrides: { deliveryMode?: string; skip?: boolean }) {
  const aggregate = new NotificationBuilder()
    .withId(randomUUID())
    .withTenantId(randomUUID())
    .withRecipientUserId(randomUUID())
    .withChannel('DISCORD')
    .withTitle('Title')
    .withBody('Body')
    .withSourceService('gardenia')
    .withDedupeKey(randomUUID())
    .withDeliveryMode(overrides.deliveryMode ?? 'DELIVER')
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();

  if (overrides.skip) {
    aggregate.skip();
  }

  return aggregate;
}

describe('Notification find-by-criteria (e2e)', () => {
  let ctx: E2EContext;
  let writeRepository: INotificationWriteRepository;

  const query = `
    query ($input: NotificationFindByCriteriaRequestDto) {
      notificationsFindByCriteria(input: $input) {
        total
        page
        perPage
        totalPages
        items {
          id
          status
          deliveryMode
        }
      }
    }
  `;

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

  it('filters by deliveryMode EQUALS RECORD_ONLY, returning only those rows', async () => {
    const deliver = buildAggregate({ deliveryMode: 'DELIVER' });
    const recordOnly = buildAggregate({
      deliveryMode: 'RECORD_ONLY',
      skip: true,
    });
    await writeRepository.save(deliver);
    await writeRepository.save(recordOnly);

    const res = await gql(ctx.app, query, {
      input: {
        filters: [
          { field: 'DELIVERY_MODE', operator: 'EQUALS', value: 'RECORD_ONLY' },
        ],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.notificationsFindByCriteria.total).toBe(1);
    expect(res.body.data.notificationsFindByCriteria.items).toEqual([
      {
        id: recordOnly.id.value,
        status: 'SKIPPED',
        deliveryMode: 'RECORD_ONLY',
      },
    ]);
  });

  it('filters by status EQUALS SKIPPED, returning only those rows', async () => {
    const pending = buildAggregate({});
    const skipped = buildAggregate({ deliveryMode: 'RECORD_ONLY', skip: true });
    await writeRepository.save(pending);
    await writeRepository.save(skipped);

    const res = await gql(ctx.app, query, {
      input: {
        filters: [{ field: 'STATUS', operator: 'EQUALS', value: 'SKIPPED' }],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.notificationsFindByCriteria.total).toBe(1);
    expect(res.body.data.notificationsFindByCriteria.items).toEqual([
      {
        id: skipped.id.value,
        status: 'SKIPPED',
        deliveryMode: 'RECORD_ONLY',
      },
    ]);
  });

  it('rejects an unknown filter field with a GraphQL error and leaks no rows', async () => {
    const aggregate = buildAggregate({});
    await writeRepository.save(aggregate);

    const res = await gql(ctx.app, query, {
      input: {
        filters: [{ field: 'BODY', operator: 'EQUALS', value: 'Body' }],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.data?.notificationsFindByCriteria ?? null).toBeNull();
  });
});
