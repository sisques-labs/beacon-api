import { DateValueObject, UuidValueObject } from '@sisques-labs/nestjs-kit';

import { NotificationAggregate } from '@contexts/notifications/domain/aggregates/notification.aggregate';
import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationDeliveryModeEnum } from '@contexts/notifications/domain/enums/notification-delivery-mode.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';
import { NotificationCancelledEvent } from '@contexts/notifications/domain/events/notification-cancelled/notification-cancelled.event';
import { NotificationCreatedEvent } from '@contexts/notifications/domain/events/notification-created/notification-created.event';
import { NotificationFailedEvent } from '@contexts/notifications/domain/events/notification-failed/notification-failed.event';
import { NotificationReadEvent } from '@contexts/notifications/domain/events/notification-read/notification-read.event';
import { NotificationSentEvent } from '@contexts/notifications/domain/events/notification-sent/notification-sent.event';
import { NotificationSkippedEvent } from '@contexts/notifications/domain/events/notification-skipped/notification-skipped.event';
import { InvalidNotificationStatusTransitionException } from '@contexts/notifications/domain/exceptions/invalid-notification-status-transition.exception';
import { NotificationBodyValueObject } from '@contexts/notifications/domain/value-objects/notification-body/notification-body.value-object';
import { NotificationChannelValueObject } from '@contexts/notifications/domain/value-objects/notification-channel/notification-channel.value-object';
import { NotificationDedupeKeyValueObject } from '@contexts/notifications/domain/value-objects/notification-dedupe-key/notification-dedupe-key.value-object';
import { NotificationDeliveryModeValueObject } from '@contexts/notifications/domain/value-objects/notification-delivery-mode/notification-delivery-mode.value-object';
import { NotificationSourceServiceValueObject } from '@contexts/notifications/domain/value-objects/notification-source-service/notification-source-service.value-object';
import { NotificationStatusValueObject } from '@contexts/notifications/domain/value-objects/notification-status/notification-status.value-object';
import { NotificationTitleValueObject } from '@contexts/notifications/domain/value-objects/notification-title/notification-title.value-object';

const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const RECIPIENT_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const NOW = new Date('2024-01-01T00:00:00.000Z');

const buildPending = (
  deliveryMode: NotificationDeliveryModeEnum = NotificationDeliveryModeEnum.DELIVER,
): NotificationAggregate =>
  new NotificationAggregate({
    id: new UuidValueObject(NOTIFICATION_ID),
    tenantId: new UuidValueObject(TENANT_ID),
    recipientUserId: new UuidValueObject(RECIPIENT_USER_ID),
    channel: new NotificationChannelValueObject(NotificationChannelEnum.EMAIL),
    status: new NotificationStatusValueObject(NotificationStatusEnum.PENDING),
    title: new NotificationTitleValueObject('Hello'),
    body: new NotificationBodyValueObject('Body text'),
    sourceService: new NotificationSourceServiceValueObject('gardenia-api'),
    dedupeKey: new NotificationDedupeKeyValueObject('gardenia:plant:1:watered'),
    deliveryMode: new NotificationDeliveryModeValueObject(deliveryMode),
    failureReason: null,
    sentAt: null,
    readAt: null,
    cancelledAt: null,
    createdAt: new DateValueObject(NOW),
    updatedAt: new DateValueObject(NOW),
  });

describe('NotificationAggregate', () => {
  describe('create()', () => {
    it('emits NotificationCreatedEvent with PENDING primitives', () => {
      const notification = buildPending();
      notification.create();

      const events = notification.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(NotificationCreatedEvent);

      const primitives = notification.toPrimitives();
      expect(primitives.status).toBe(NotificationStatusEnum.PENDING);
      expect(primitives.sentAt).toBeNull();
      expect(primitives.readAt).toBeNull();
      expect(primitives.cancelledAt).toBeNull();
      expect(primitives.failureReason).toBeNull();
      expect(primitives.dedupeKey).toBe('gardenia:plant:1:watered');
    });
  });

  describe('sent()', () => {
    it('transitions PENDING to SENT, sets sentAt, and emits NotificationSentEvent', () => {
      const notification = buildPending();
      notification.sent();

      expect(notification.status.value).toBe(NotificationStatusEnum.SENT);
      expect(notification.sentAt).not.toBeNull();
      expect(notification.getUncommittedEvents()[0]).toBeInstanceOf(
        NotificationSentEvent,
      );
    });

    it('rejects sent() when status is FAILED', () => {
      const notification = buildPending();
      notification.fail('provider error');

      expect(() => notification.sent()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
      expect(notification.status.value).toBe(NotificationStatusEnum.FAILED);
    });
  });

  describe('fail()', () => {
    it('transitions PENDING to FAILED, sets failureReason, and emits NotificationFailedEvent', () => {
      const notification = buildPending();
      notification.fail('SMTP timeout');

      expect(notification.status.value).toBe(NotificationStatusEnum.FAILED);
      expect(notification.failureReason?.value).toBe('SMTP timeout');
      expect(notification.getUncommittedEvents()[0]).toBeInstanceOf(
        NotificationFailedEvent,
      );
    });
  });

  describe('cancel()', () => {
    it('transitions PENDING to CANCELLED, sets cancelledAt, and emits NotificationCancelledEvent', () => {
      const notification = buildPending();
      notification.cancel();

      expect(notification.status.value).toBe(NotificationStatusEnum.CANCELLED);
      expect(notification.cancelledAt).not.toBeNull();
      expect(notification.getUncommittedEvents()[0]).toBeInstanceOf(
        NotificationCancelledEvent,
      );
    });

    it('rejects cancel() when status is SENT', () => {
      const notification = buildPending();
      notification.sent();

      expect(() => notification.cancel()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
      expect(notification.status.value).toBe(NotificationStatusEnum.SENT);
    });
  });

  describe('read()', () => {
    it('transitions SENT to READ, sets readAt, and emits NotificationReadEvent', () => {
      const notification = buildPending();
      notification.sent();
      notification.read();

      expect(notification.status.value).toBe(NotificationStatusEnum.READ);
      expect(notification.readAt).not.toBeNull();
      const events = notification.getUncommittedEvents();
      expect(events[events.length - 1]).toBeInstanceOf(NotificationReadEvent);
    });

    it('rejects read() when status is PENDING', () => {
      const notification = buildPending();

      expect(() => notification.read()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
      expect(notification.status.value).toBe(NotificationStatusEnum.PENDING);
      expect(notification.getUncommittedEvents()).toHaveLength(0);
    });
  });

  describe('skip()', () => {
    it('transitions PENDING to SKIPPED and emits NotificationSkippedEvent', () => {
      const notification = buildPending(
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
      notification.skip();

      expect(notification.status.value).toBe(NotificationStatusEnum.SKIPPED);
      expect(notification.getUncommittedEvents()[0]).toBeInstanceOf(
        NotificationSkippedEvent,
      );
    });

    it.each([
      ['SENT', (n: NotificationAggregate) => n.sent()],
      ['FAILED', (n: NotificationAggregate) => n.fail('provider error')],
      ['CANCELLED', (n: NotificationAggregate) => n.cancel()],
    ])('rejects skip() when status is %s', (_label, toStatus) => {
      const notification = buildPending();
      toStatus(notification);

      expect(() => notification.skip()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });

    it('rejects skip() when status is already SKIPPED', () => {
      const notification = buildPending(
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
      notification.skip();

      expect(() => notification.skip()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });
  });

  describe('transitions out of SKIPPED are rejected', () => {
    const buildSkipped = (): NotificationAggregate => {
      const notification = buildPending(
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
      notification.skip();
      return notification;
    };

    it('rejects sent() from SKIPPED', () => {
      expect(() => buildSkipped().sent()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });

    it('rejects fail() from SKIPPED', () => {
      expect(() => buildSkipped().fail('boom')).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });

    it('rejects cancel() from SKIPPED', () => {
      expect(() => buildSkipped().cancel()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });

    it('rejects read() from SKIPPED', () => {
      expect(() => buildSkipped().read()).toThrow(
        InvalidNotificationStatusTransitionException,
      );
    });
  });

  describe('toPrimitives()', () => {
    it('returns all raw field values', () => {
      const primitives = buildPending().toPrimitives();

      expect(primitives).toEqual({
        id: NOTIFICATION_ID,
        tenantId: TENANT_ID,
        recipientUserId: RECIPIENT_USER_ID,
        channel: NotificationChannelEnum.EMAIL,
        status: NotificationStatusEnum.PENDING,
        title: 'Hello',
        body: 'Body text',
        sourceService: 'gardenia-api',
        dedupeKey: 'gardenia:plant:1:watered',
        deliveryMode: NotificationDeliveryModeEnum.DELIVER,
        failureReason: null,
        sentAt: null,
        readAt: null,
        cancelledAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
    });

    it('carries RECORD_ONLY deliveryMode', () => {
      const primitives = buildPending(
        NotificationDeliveryModeEnum.RECORD_ONLY,
      ).toPrimitives();

      expect(primitives.deliveryMode).toBe(
        NotificationDeliveryModeEnum.RECORD_ONLY,
      );
    });
  });
});
