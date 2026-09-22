import { getRepositoryToken } from '@nestjs/typeorm';
import { Criteria, FilterOperator } from '@sisques-labs/nestjs-kit';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import {
  INotificationReadRepository,
  NOTIFICATION_READ_REPOSITORY,
} from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationsModule } from '@contexts/notifications/notifications.module';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';

function buildAggregate(overrides: {
  tenantId?: string;
  dedupeKey?: string;
  deliveryMode?: string;
}) {
  return new NotificationBuilder()
    .withId(randomUUID())
    .withTenantId(overrides.tenantId ?? randomUUID())
    .withRecipientUserId(randomUUID())
    .withChannel('DISCORD')
    .withTitle('Title')
    .withBody('Body')
    .withSourceService('gardenia')
    .withDedupeKey(overrides.dedupeKey ?? randomUUID())
    .withDeliveryMode(overrides.deliveryMode ?? 'DELIVER')
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('Notification TypeORM repositories (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepository: INotificationWriteRepository;
  let readRepository: INotificationReadRepository;
  let ormRepository: Repository<NotificationEntity>;

  beforeAll(async () => {
    ctx = await createIntegrationModule({ imports: [NotificationsModule] });
    writeRepository = ctx.module.get(NOTIFICATION_WRITE_REPOSITORY);
    readRepository = ctx.module.get(NOTIFICATION_READ_REPOSITORY);
    ormRepository = ctx.module.get(getRepositoryToken(NotificationEntity));
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ormRepository.query(
      'TRUNCATE "notifications" RESTART IDENTITY CASCADE',
    );
  });

  it('persists an aggregate and reads it back via the write repository', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const found = await writeRepository.findById(aggregate.id.value);

    expect(found).not.toBeNull();
    expect(found?.tenantId.value).toBe(aggregate.tenantId.value);
    expect(found?.dedupeKey.value).toBe(aggregate.dedupeKey.value);
  });

  it('reads the persisted notification via the read repository as a view model', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const viewModel = await readRepository.findById(aggregate.id.value);

    expect(viewModel).not.toBeNull();
    expect(viewModel?.status).toBe('PENDING');
    expect(viewModel?.dedupeKey).toBe(aggregate.dedupeKey.value);
  });

  it('findByDedupeKey returns the existing notification for the same (tenantId, dedupeKey)', async () => {
    const tenantId = randomUUID();
    const dedupeKey = randomUUID();
    const aggregate = buildAggregate({ tenantId, dedupeKey });

    await writeRepository.save(aggregate);
    const found = await writeRepository.findByDedupeKey(tenantId, dedupeKey);

    expect(found).not.toBeNull();
    expect(found?.id.value).toBe(aggregate.id.value);
  });

  it('findByDedupeKey returns null when no notification matches', async () => {
    const found = await writeRepository.findByDedupeKey(
      randomUUID(),
      randomUUID(),
    );

    expect(found).toBeNull();
  });

  it('enforces the (tenantId, dedupeKey) unique index — a second insert is rejected', async () => {
    const tenantId = randomUUID();
    const dedupeKey = randomUUID();
    const first = buildAggregate({ tenantId, dedupeKey });
    const second = buildAggregate({ tenantId, dedupeKey });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).rejects.toBeInstanceOf(
      NotificationDedupeKeyAlreadyExistsException,
    );
  });

  it('allows the same dedupeKey across different tenants', async () => {
    const dedupeKey = randomUUID();
    const first = buildAggregate({ tenantId: randomUUID(), dedupeKey });
    const second = buildAggregate({ tenantId: randomUUID(), dedupeKey });

    await writeRepository.save(first);

    await expect(writeRepository.save(second)).resolves.toBeDefined();
  });

  it('persists and reads back a RECORD_ONLY notification transitioned to SKIPPED', async () => {
    const aggregate = buildAggregate({ deliveryMode: 'RECORD_ONLY' });
    aggregate.skip();

    await writeRepository.save(aggregate);
    const found = await writeRepository.findById(aggregate.id.value);
    const viewModel = await readRepository.findById(aggregate.id.value);

    expect(found?.deliveryMode.value).toBe('RECORD_ONLY');
    expect(found?.status.value).toBe('SKIPPED');
    expect(viewModel?.deliveryMode).toBe('RECORD_ONLY');
    expect(viewModel?.status).toBe('SKIPPED');
  });

  it('defaults deliveryMode to DELIVER when not explicitly set', async () => {
    const aggregate = buildAggregate({});

    await writeRepository.save(aggregate);
    const found = await writeRepository.findById(aggregate.id.value);

    expect(found?.deliveryMode.value).toBe('DELIVER');
  });

  describe('findByCriteria', () => {
    it('filters by deliveryMode eq RECORD_ONLY, returning only those rows', async () => {
      const deliver = buildAggregate({ deliveryMode: 'DELIVER' });
      const recordOnly = buildAggregate({ deliveryMode: 'RECORD_ONLY' });
      recordOnly.skip();
      await writeRepository.save(deliver);
      await writeRepository.save(recordOnly);

      const result = await readRepository.findByCriteria(
        new Criteria([
          {
            field: 'deliveryMode',
            operator: FilterOperator.EQUALS,
            value: 'RECORD_ONLY',
          },
        ]),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(recordOnly.id.value);
      expect(result.items[0].deliveryMode).toBe('RECORD_ONLY');
    });

    it('filters by status eq SKIPPED, returning only those rows', async () => {
      const pending = buildAggregate({});
      const skipped = buildAggregate({ deliveryMode: 'RECORD_ONLY' });
      skipped.skip();
      await writeRepository.save(pending);
      await writeRepository.save(skipped);

      const result = await readRepository.findByCriteria(
        new Criteria([
          {
            field: 'status',
            operator: FilterOperator.EQUALS,
            value: 'SKIPPED',
          },
        ]),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(skipped.id.value);
      expect(result.items[0].status).toBe('SKIPPED');
    });

    it('filters with an IN operator across both deliveryMode values, returning both', async () => {
      const deliver = buildAggregate({ deliveryMode: 'DELIVER' });
      const recordOnly = buildAggregate({ deliveryMode: 'RECORD_ONLY' });
      await writeRepository.save(deliver);
      await writeRepository.save(recordOnly);

      const result = await readRepository.findByCriteria(
        new Criteria([
          {
            field: 'deliveryMode',
            operator: FilterOperator.IN,
            value: ['DELIVER', 'RECORD_ONLY'],
          },
        ]),
      );

      const ids = result.items.map((item) => item.id).sort();
      expect(ids).toEqual([deliver.id.value, recordOnly.id.value].sort());
    });

    it('computes total and totalPages correctly across pages', async () => {
      for (let i = 0; i < 5; i += 1) {
        await writeRepository.save(buildAggregate({}));
      }

      const result = await readRepository.findByCriteria(
        new Criteria([], [], { page: 1, perPage: 2 }),
      );

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(2);
      expect(result.totalPages).toBe(3);
    });
  });
});
