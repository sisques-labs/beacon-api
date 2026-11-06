import { FieldIsRequiredException } from '@sisques-labs/nestjs-kit';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationViewModel } from '@contexts/notifications/domain/view-models/notification-channel-destination.view-model';

import { NotificationChannelDestinationBuilder } from '@contexts/notifications/domain/builders/notification-channel-destination.builder';

const DESTINATION_ID = '660e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '660e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');
const ENVELOPE =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';

const seed = (
  builder: NotificationChannelDestinationBuilder,
): NotificationChannelDestinationBuilder =>
  builder
    .withId(DESTINATION_ID)
    .withTenantId(TENANT_ID)
    .withChannel(NotificationChannelEnum.DISCORD)
    .withEnvelope(ENVELOPE)
    .withCreatedAt(NOW)
    .withUpdatedAt(NOW);

describe('NotificationChannelDestinationBuilder', () => {
  let builder: NotificationChannelDestinationBuilder;

  beforeEach(() => {
    builder = new NotificationChannelDestinationBuilder();
  });

  describe('build()', () => {
    it('returns a NotificationChannelDestinationAggregate wrapping the given envelope', () => {
      const aggregate = seed(builder).build();

      expect(aggregate).toBeInstanceOf(NotificationChannelDestinationAggregate);
      expect(aggregate.id.value).toBe(DESTINATION_ID);
      expect(aggregate.tenantId.value).toBe(TENANT_ID);
      expect(aggregate.channel.value).toBe(NotificationChannelEnum.DISCORD);
      expect(aggregate.envelope.value).toBe(ENVELOPE);
    });

    it('returns an aggregate whose register() emits exactly one event', () => {
      const aggregate = seed(builder).build();

      aggregate.register();

      expect(aggregate.getUncommittedEvents()).toHaveLength(1);
    });

    it.each([
      [
        'tenantId',
        (b: NotificationChannelDestinationBuilder) => b.withTenantId(''),
      ],
      [
        'channel',
        (b: NotificationChannelDestinationBuilder) =>
          b.withChannel('' as never),
      ],
      [
        'envelope',
        (b: NotificationChannelDestinationBuilder) => b.withEnvelope(''),
      ],
    ])(
      'throws FieldIsRequiredException when %s is missing',
      (_field, mutate) => {
        const incomplete = mutate(seed(builder));

        expect(() => incomplete.build()).toThrow(FieldIsRequiredException);
      },
    );
  });

  describe('buildViewModel()', () => {
    it('returns a NotificationChannelDestinationViewModel with no envelope field', () => {
      const vm = seed(builder).buildViewModel();

      expect(vm).toBeInstanceOf(NotificationChannelDestinationViewModel);
      expect(vm.id).toBe(DESTINATION_ID);
      expect(vm.tenantId).toBe(TENANT_ID);
      expect(vm.channel).toBe(NotificationChannelEnum.DISCORD);
      expect(vm).not.toHaveProperty('envelope');
    });
  });
});
