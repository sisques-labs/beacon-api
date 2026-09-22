import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification.mapper';

function buildResult(): CreateNotificationResult {
  return {
    id: '11111111-1111-4111-8111-111111111111',
  };
}

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
    deliveryMode: 'RECORD_ONLY',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationRestMapper', () => {
  const mapper = new NotificationRestMapper();

  it('maps a CreateNotificationResult to a NotificationCreateResponseDto preserving the id', () => {
    const result = buildResult();

    const dto = mapper.toResponseDtoFromResult(result);

    expect(dto.id).toBe(result.id);
  });

  it('maps a view model to a NotificationResponseDto preserving all fields including deliveryMode', () => {
    const viewModel = buildViewModel();

    const dto = mapper.toResponseDtoFromViewModel(viewModel);

    expect(dto.id).toBe(viewModel.id);
    expect(dto.tenantId).toBe(viewModel.tenantId);
    expect(dto.recipientUserId).toBe(viewModel.recipientUserId);
    expect(dto.channel).toBe(viewModel.channel);
    expect(dto.status).toBe(viewModel.status);
    expect(dto.title).toBe(viewModel.title);
    expect(dto.body).toBe(viewModel.body);
    expect(dto.sourceService).toBe(viewModel.sourceService);
    expect(dto.dedupeKey).toBe(viewModel.dedupeKey);
    expect(dto.deliveryMode).toBe('RECORD_ONLY');
    expect(dto.failureReason).toBeNull();
    expect(dto.createdAt).toBe(viewModel.createdAt);
    expect(dto.updatedAt).toBe(viewModel.updatedAt);
  });
});
