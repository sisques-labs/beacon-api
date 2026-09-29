import {
  Criteria,
  FilterOperator,
  PaginatedResult,
} from '@sisques-labs/nestjs-kit';
import { Mocked, vi } from 'vitest';

import { NotificationChannelDestinationFindByCriteriaHandler } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.handler';
import { NotificationChannelDestinationFindByCriteriaQuery } from '@contexts/notifications/application/queries/notification-channel-destination-find-by-criteria/notification-channel-destination-find-by-criteria.query';
import { UnsupportedCriteriaFieldException } from '@contexts/notifications/domain/exceptions/unsupported-criteria-field.exception';
import { INotificationChannelDestinationReadRepository } from '@contexts/notifications/domain/repositories/read/notification-channel-destination-read.repository';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

function buildViewModel(): NotificationChannelDestinationViewModel {
  return new NotificationChannelDestinationViewModel({
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    channel: 'DISCORD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('NotificationChannelDestinationFindByCriteriaHandler', () => {
  let handler: NotificationChannelDestinationFindByCriteriaHandler;
  let readRepository: Mocked<INotificationChannelDestinationReadRepository>;

  beforeEach(() => {
    readRepository = {
      findByCriteria: vi.fn(),
    } as unknown as Mocked<INotificationChannelDestinationReadRepository>;
    handler = new NotificationChannelDestinationFindByCriteriaHandler(
      readRepository,
    );
  });

  it('delegates the exact criteria to the read repository and returns its page', async () => {
    const criteria = new Criteria([
      {
        field: 'tenantId',
        operator: FilterOperator.EQUALS,
        value: '22222222-2222-4222-8222-222222222222',
      },
    ]);
    const page = new PaginatedResult([buildViewModel()], 1, 1, 10);
    readRepository.findByCriteria.mockResolvedValue(page);

    const result = await handler.execute(
      new NotificationChannelDestinationFindByCriteriaQuery({ criteria }),
    );

    expect(readRepository.findByCriteria).toHaveBeenCalledWith(criteria);
    expect(result).toBe(page);
  });

  it('returns an empty page as-is', async () => {
    const page = new PaginatedResult<NotificationChannelDestinationViewModel>(
      [],
      0,
      1,
      10,
    );
    readRepository.findByCriteria.mockResolvedValue(page);

    const result = await handler.execute(
      new NotificationChannelDestinationFindByCriteriaQuery({
        criteria: new Criteria(),
      }),
    );

    expect(result.items).toEqual([]);
  });

  it('propagates a field-allowlist rejection from the repository', async () => {
    const rejection = new UnsupportedCriteriaFieldException(
      'filter',
      'encryptedAddress',
      ['id'],
    );
    readRepository.findByCriteria.mockRejectedValue(rejection);

    await expect(
      handler.execute(
        new NotificationChannelDestinationFindByCriteriaQuery({
          criteria: new Criteria(),
        }),
      ),
    ).rejects.toBe(rejection);
  });

  it('logs at entry', async () => {
    readRepository.findByCriteria.mockResolvedValue(
      new PaginatedResult([], 0, 1, 10),
    );
    const logSpy = vi.spyOn(
      (handler as unknown as { logger: { log: (m: string) => void } }).logger,
      'log',
    );

    await handler.execute(
      new NotificationChannelDestinationFindByCriteriaQuery({
        criteria: new Criteria(),
      }),
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
