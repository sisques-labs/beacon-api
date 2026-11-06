import { NotificationFindByIdQuery } from '@contexts/notifications/application/queries/notification-find-by-id/notification-find-by-id.query';

const TENANT_ID = '22222222-2222-4222-8222-222222222222';

describe('NotificationFindByIdQuery', () => {
  it('wraps the input id in a UuidValueObject', () => {
    const query = new NotificationFindByIdQuery({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: TENANT_ID,
    });

    expect(query.id.value).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('throws when the id is not a valid UUID', () => {
    expect(
      () =>
        new NotificationFindByIdQuery({
          id: 'not-a-uuid',
          tenantId: TENANT_ID,
        }),
    ).toThrow();
  });

  it('wraps the input tenantId in a UuidValueObject (D25)', () => {
    const query = new NotificationFindByIdQuery({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: TENANT_ID,
    });

    expect(query.tenantId.value).toBe(TENANT_ID);
  });

  it('throws when the tenantId is not a valid UUID', () => {
    expect(
      () =>
        new NotificationFindByIdQuery({
          id: '11111111-1111-4111-8111-111111111111',
          tenantId: 'not-a-uuid',
        }),
    ).toThrow();
  });
});
