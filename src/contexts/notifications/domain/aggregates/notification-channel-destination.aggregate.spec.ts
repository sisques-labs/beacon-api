import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationChannelDestinationRegisteredEvent } from '@contexts/notifications/domain/events/notification-channel-destination-registered/notification-channel-destination-registered.event';
import { NotificationChannelDestinationRotatedEvent } from '@contexts/notifications/domain/events/notification-channel-destination-rotated/notification-channel-destination-rotated.event';
import { EncryptedSecretValueObject } from '@contexts/notifications/domain/value-objects/encrypted-secret/encrypted-secret.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';

import { NotificationChannelDestinationAggregate } from '@contexts/notifications/domain/aggregates/notification-channel-destination.aggregate';

const DESTINATION_ID = '660e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '660e8400-e29b-41d4-a716-446655440001';
const NOW = new Date('2024-01-01T00:00:00.000Z');
const ENVELOPE_V1 =
  'v1:aaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:Y2lwaGVydGV4dA';
const ENVELOPE_V2 =
  'v1:cccccccccccccccccccc:dddddddddddddddddddddddddddddddd:cm90YXRlZC1jaXBoZXJ0ZXh0';

const buildDestination = (
  envelope: string = ENVELOPE_V1,
): NotificationChannelDestinationAggregate =>
  new NotificationChannelDestinationAggregate({
    id: new UuidValueObject(DESTINATION_ID),
    tenantId: new UuidValueObject(TENANT_ID),
    channel: new NotificationChannelValueObject(
      NotificationChannelEnum.DISCORD,
    ),
    envelope: new EncryptedSecretValueObject(envelope),
    createdAt: new DateValueObject(NOW),
    updatedAt: new DateValueObject(NOW),
  });

describe('NotificationChannelDestinationAggregate', () => {
  describe('constructor', () => {
    it('never emits an event on hydration', () => {
      const destination = buildDestination();

      expect(destination.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('register()', () => {
    it('emits NotificationChannelDestinationRegisteredEvent with metadata-only payload', () => {
      const destination = buildDestination();

      destination.register();

      const events = destination.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(
        NotificationChannelDestinationRegisteredEvent,
      );

      const event = events[0] as NotificationChannelDestinationRegisteredEvent;
      expect(event.data).toEqual({
        id: DESTINATION_ID,
        tenantId: TENANT_ID,
        channel: NotificationChannelEnum.DISCORD,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('never includes the encrypted envelope in the event payload', () => {
      const destination = buildDestination();

      destination.register();

      const event =
        destination.getUncommittedEvents()[0] as NotificationChannelDestinationRegisteredEvent;
      expect(Object.keys(event.data)).toEqual([
        'id',
        'tenantId',
        'channel',
        'createdAt',
        'updatedAt',
      ]);
      expect(JSON.stringify(event.data)).not.toContain(ENVELOPE_V1);
    });
  });

  describe('rotate()', () => {
    it('replaces the envelope, touches updatedAt, and emits NotificationChannelDestinationRotatedEvent', () => {
      const destination = buildDestination(ENVELOPE_V1);
      const newEnvelope = new EncryptedSecretValueObject(ENVELOPE_V2);

      destination.rotate(newEnvelope);

      expect(destination.envelope.value).toBe(ENVELOPE_V2);
      expect(destination.updatedAt.value.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );

      const events = destination.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(
        NotificationChannelDestinationRotatedEvent,
      );
    });

    it('never includes the encrypted envelope in the rotated event payload', () => {
      const destination = buildDestination(ENVELOPE_V1);

      destination.rotate(new EncryptedSecretValueObject(ENVELOPE_V2));

      const event =
        destination.getUncommittedEvents()[0] as NotificationChannelDestinationRotatedEvent;
      expect(Object.keys(event.data)).toEqual([
        'id',
        'tenantId',
        'channel',
        'createdAt',
        'updatedAt',
      ]);
      expect(JSON.stringify(event.data)).not.toContain(ENVELOPE_V2);
    });
  });

  describe('getters', () => {
    it('exposes tenantId, channel, and envelope value objects', () => {
      const destination = buildDestination();

      expect(destination.tenantId.value).toBe(TENANT_ID);
      expect(destination.channel.value).toBe(NotificationChannelEnum.DISCORD);
      expect(destination.envelope.value).toBe(ENVELOPE_V1);
    });
  });

  describe('toPrimitives()', () => {
    it('returns the persistence shape including the encrypted envelope', () => {
      const destination = buildDestination();

      expect(destination.toPrimitives()).toEqual({
        id: DESTINATION_ID,
        tenantId: TENANT_ID,
        channel: NotificationChannelEnum.DISCORD,
        envelope: ENVELOPE_V1,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('reflects the rotated envelope and the touched updatedAt', () => {
      const destination = buildDestination(ENVELOPE_V1);

      destination.rotate(new EncryptedSecretValueObject(ENVELOPE_V2));
      const primitives = destination.toPrimitives();

      expect(primitives.envelope).toBe(ENVELOPE_V2);
      expect(primitives.updatedAt.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime(),
      );
    });
  });
});
