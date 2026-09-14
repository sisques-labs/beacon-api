import { CreateNotificationResult } from '@contexts/notifications/application/commands/create-notification/create-notification-result.interface';
import { NotificationRestMapper } from '@contexts/notifications/transport/rest/mappers/notification.mapper';

function buildResult(): CreateNotificationResult {
  return {
    id: '11111111-1111-4111-8111-111111111111',
  };
}

describe('NotificationRestMapper', () => {
  const mapper = new NotificationRestMapper();

  it('maps a CreateNotificationResult to a NotificationCreateResponseDto preserving the id', () => {
    const result = buildResult();

    const dto = mapper.toResponseDtoFromResult(result);

    expect(dto.id).toBe(result.id);
  });
});
