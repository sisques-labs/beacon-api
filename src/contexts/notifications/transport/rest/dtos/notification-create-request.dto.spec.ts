import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NotificationCreateRequestDto } from '@contexts/notifications/transport/rest/dtos/notification-create-request.dto';

const VALID_PAYLOAD = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  recipientUserId: '22222222-2222-4222-8222-222222222222',
  channel: 'DISCORD',
  title: 'Plant watered',
  body: 'Your plant was watered successfully.',
  sourceService: 'gardenia-api',
  dedupeKey: 'gardenia:plant:1:watered',
};

describe('NotificationCreateRequestDto', () => {
  it('passes validation for a well-formed DISCORD payload', async () => {
    const dto = plainToInstance(NotificationCreateRequestDto, VALID_PAYLOAD);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails validation when a required field is missing', async () => {
    const { dedupeKey: _dedupeKey, ...withoutDedupeKey } = VALID_PAYLOAD;
    const dto = plainToInstance(NotificationCreateRequestDto, withoutDedupeKey);

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('dedupeKey');
  });

  it('fails validation when tenantId is not a UUID', async () => {
    const dto = plainToInstance(NotificationCreateRequestDto, {
      ...VALID_PAYLOAD,
      tenantId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('tenantId');
  });

  it('rejects EMAIL — D5 restricts the write path to DISCORD only', async () => {
    const dto = plainToInstance(NotificationCreateRequestDto, {
      ...VALID_PAYLOAD,
      channel: 'EMAIL',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('channel');
  });

  it('rejects PUSH — D5 restricts the write path to DISCORD only', async () => {
    const dto = plainToInstance(NotificationCreateRequestDto, {
      ...VALID_PAYLOAD,
      channel: 'PUSH',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('channel');
  });
});
