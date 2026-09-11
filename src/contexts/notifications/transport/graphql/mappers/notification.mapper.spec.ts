import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationGraphqlMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';

function buildViewModel(): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: 'PENDING',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationGraphqlMapper', () => {
  const mapper = new NotificationGraphqlMapper();

  it('maps a view model to a NotificationObject preserving all fields', () => {
    const viewModel = buildViewModel();

    const object = mapper.toObject(viewModel);

    expect(object.id).toBe(viewModel.id);
    expect(object.tenantId).toBe(viewModel.tenantId);
    expect(object.recipientUserId).toBe(viewModel.recipientUserId);
    expect(object.channel).toBe(viewModel.channel);
    expect(object.status).toBe(viewModel.status);
    expect(object.title).toBe(viewModel.title);
    expect(object.body).toBe(viewModel.body);
    expect(object.sourceService).toBe(viewModel.sourceService);
    expect(object.dedupeKey).toBe(viewModel.dedupeKey);
    expect(object.failureReason).toBeNull();
    expect(object.createdAt).toBe(viewModel.createdAt);
    expect(object.updatedAt).toBe(viewModel.updatedAt);
  });
});
