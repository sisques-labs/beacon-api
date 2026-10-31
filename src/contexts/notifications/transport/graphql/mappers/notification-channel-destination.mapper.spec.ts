import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';
import { NotificationChannelDestinationGraphQLMapper } from '@contexts/notifications/transport/graphql/mappers/notification-channel-destination.mapper';

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationGraphQLMapper', () => {
  let mapper: NotificationChannelDestinationGraphQLMapper;

  beforeEach(() => {
    mapper = new NotificationChannelDestinationGraphQLMapper();
  });

  it('maps a view model to a configured metadata response DTO', () => {
    const viewModel = buildViewModel();

    const dto = mapper.toResponseDtoFromViewModel(viewModel);

    expect(dto).toEqual({
      configured: true,
      id: viewModel.id,
      channel: viewModel.channel,
      createdAt: viewModel.createdAt,
      updatedAt: viewModel.updatedAt,
    });
  });

  it('maps a null view model to an unconfigured response DTO with no other field', () => {
    const dto = mapper.toResponseDtoFromViewModel(null);

    expect(dto).toEqual({ configured: false });
  });
});
