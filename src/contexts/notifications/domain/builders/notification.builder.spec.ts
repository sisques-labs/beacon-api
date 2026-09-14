import { FieldIsRequiredException } from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationViewModel } from '@contexts/notifications/domain/view-models/notification.view-model';

import { NotificationBuilder } from '@contexts/notifications/domain/builders/notification.builder';

const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const RECIPIENT_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const NOW = new Date('2024-01-01T00:00:00.000Z');

const seed = (builder: NotificationBuilder): NotificationBuilder =>
  builder
    .withId(NOTIFICATION_ID)
    .withTenantId(TENANT_ID)
    .withRecipientUserId(RECIPIENT_USER_ID)
    .withChannel(NotificationChannelEnum.EMAIL)
    .withTitle('Hello')
    .withBody('Body text')
    .withSourceService('gardenia-api')
    .withDedupeKey('gardenia:plant:1:watered')
    .withCreatedAt(NOW)
    .withUpdatedAt(NOW);

describe('NotificationBuilder', () => {
  let builder: NotificationBuilder;

  beforeEach(() => {
    builder = new NotificationBuilder();
  });

  describe('build()', () => {
    it('returns a NotificationAggregate defaulting to PENDING with null optionals', () => {
      const aggregate = seed(builder).build();

      expect(aggregate).toBeInstanceOf(NotificationAggregate);
      expect(aggregate.id.value).toBe(NOTIFICATION_ID);
      expect(aggregate.tenantId.value).toBe(TENANT_ID);
      expect(aggregate.recipientUserId.value).toBe(RECIPIENT_USER_ID);
      expect(aggregate.channel.value).toBe(NotificationChannelEnum.EMAIL);
      expect(aggregate.status.value).toBe(NotificationStatusEnum.PENDING);
      expect(aggregate.title.value).toBe('Hello');
      expect(aggregate.body.value).toBe('Body text');
      expect(aggregate.sourceService.value).toBe('gardenia-api');
      expect(aggregate.dedupeKey.value).toBe('gardenia:plant:1:watered');
      expect(aggregate.failureReason).toBeNull();
      expect(aggregate.sentAt).toBeNull();
      expect(aggregate.readAt).toBeNull();
      expect(aggregate.cancelledAt).toBeNull();
    });

    it.each([
      ['tenantId', (b: NotificationBuilder) => b.withTenantId('')],
      [
        'recipientUserId',
        (b: NotificationBuilder) => b.withRecipientUserId(''),
      ],
      ['channel', (b: NotificationBuilder) => b.withChannel('' as never)],
      ['title', (b: NotificationBuilder) => b.withTitle('')],
      ['body', (b: NotificationBuilder) => b.withBody('')],
      ['sourceService', (b: NotificationBuilder) => b.withSourceService('')],
      ['dedupeKey', (b: NotificationBuilder) => b.withDedupeKey('')],
    ])(
      'throws FieldIsRequiredException when %s is missing',
      (_field, mutate) => {
        const incomplete = mutate(seed(builder));

        expect(() => incomplete.build()).toThrow(FieldIsRequiredException);
      },
    );

    it('throws FieldIsRequiredException when dedupeKey was never set', () => {
      builder
        .withId(NOTIFICATION_ID)
        .withTenantId(TENANT_ID)
        .withRecipientUserId(RECIPIENT_USER_ID)
        .withChannel(NotificationChannelEnum.PUSH)
        .withTitle('Hello')
        .withBody('Body')
        .withSourceService('beacon')
        .withCreatedAt(NOW)
        .withUpdatedAt(NOW);

      expect(() => builder.build()).toThrow(FieldIsRequiredException);
    });
  });

  describe('buildViewModel()', () => {
    it('returns a NotificationViewModel with the provided values', () => {
      const vm = seed(builder).buildViewModel();

      expect(vm).toBeInstanceOf(NotificationViewModel);
      expect(vm.id).toBe(NOTIFICATION_ID);
      expect(vm.tenantId).toBe(TENANT_ID);
      expect(vm.recipientUserId).toBe(RECIPIENT_USER_ID);
      expect(vm.channel).toBe(NotificationChannelEnum.EMAIL);
      expect(vm.status).toBe(NotificationStatusEnum.PENDING);
      expect(vm.title).toBe('Hello');
      expect(vm.body).toBe('Body text');
      expect(vm.sourceService).toBe('gardenia-api');
      expect(vm.dedupeKey).toBe('gardenia:plant:1:watered');
      expect(vm.failureReason).toBeNull();
      expect(vm.sentAt).toBeNull();
      expect(vm.readAt).toBeNull();
      expect(vm.cancelledAt).toBeNull();
    });
  });
});
