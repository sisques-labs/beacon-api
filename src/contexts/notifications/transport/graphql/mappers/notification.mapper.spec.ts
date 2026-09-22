import { PaginatedResult } from '@sisques-labs/nestjs-kit';

import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';
import { NotificationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification.mapper';

function buildViewModel(
  overrides: Partial<{ status: string; deliveryMode: string }> = {},
): NotificationViewModel {
  return new NotificationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    recipientUserId: '33333333-3333-4333-8333-333333333333',
    channel: 'DISCORD',
    status: overrides.status ?? 'PENDING',
    title: 'Title',
    body: 'Body',
    sourceService: 'gardenia',
    dedupeKey: 'dedupe-key-1',
    deliveryMode: overrides.deliveryMode ?? 'DELIVER',
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationGraphQLMapper', () => {
  const mapper = new NotificationGraphQLMapper();

  it('maps a view model to a NotificationResponseDto preserving all fields', () => {
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
    expect(dto.deliveryMode).toBe(viewModel.deliveryMode);
    expect(dto.failureReason).toBeNull();
    expect(dto.createdAt).toBe(viewModel.createdAt);
    expect(dto.updatedAt).toBe(viewModel.updatedAt);
  });

  it('maps a PaginatedResult to a NotificationPaginatedResponseDto, mapping deliveryMode and SKIPPED per item', () => {
    const skipped = buildViewModel({
      status: 'SKIPPED',
      deliveryMode: 'RECORD_ONLY',
    });
    const paginatedResult = new PaginatedResult([skipped], 1, 2, 10);

    const dto =
      mapper.toPaginatedResponseDtoFromPaginatedResult(paginatedResult);

    expect(dto.items).toHaveLength(1);
    expect(dto.items[0].status).toBe('SKIPPED');
    expect(dto.items[0].deliveryMode).toBe('RECORD_ONLY');
    expect(dto.items[0].dedupeKey).toBe(skipped.dedupeKey);
    expect(dto.total).toBe(1);
    expect(dto.page).toBe(2);
    expect(dto.perPage).toBe(10);
    expect(dto.totalPages).toBe(paginatedResult.totalPages);
  });
});
