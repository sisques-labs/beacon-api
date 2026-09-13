import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';
import { NotificationDedupeKeyAlreadyExistsException } from '@contexts/notifications/domain/exceptions/notification-dedupe-key-already-exists.exception';
import { NOTIFICATION_READ_REPOSITORY } from '@contexts/notifications/domain/repositories/read/notification-read.repository';
import {
  INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@contexts/notifications/domain/repositories/write/notification-write.repository';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationEntity } from '@contexts/notifications/infrastructure/persistence/typeorm/entities/notification.entity';
import { NotificationsModule } from '@contexts/notifications/notifications.module';

import {
  createIntegrationModule,
  IntegrationContext,
} from '../../helpers/integration-bootstrap';

function buildAggregate(overrides: { tenantId?: string; dedupeKey?: string }) {
  return new NotificationBuilder()
    .withId(randomUUID())
    .withTenantId(overrides.tenantId ?? randomUUID())
    .withRecipientUserId(randomUUID())
    .withChannel('DISCORD')
    .withTitle('Title')
    .withBody('Body')
    .withSourceService('gardenia')
    .withDedupeKey(overrides.dedupeKey ?? randomUUID())
    .withCreatedAt(new Date())
    .withUpdatedAt(new Date())
    .build();
}

describe('Notification TypeORM repositories (integration)', () => {
  let ctx: IntegrationContext;
  let writeRepository: INotificationWriteRepository;
  let readRepository: {
    findById(id: string): Promise<NotificationViewModel | null>;
  };
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
});
