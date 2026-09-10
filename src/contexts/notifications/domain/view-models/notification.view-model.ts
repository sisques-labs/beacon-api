import { BaseViewModel } from '@sisques-labs/nestjs-kit';

import { INotificationPrimitives } from '@contexts/notifications/domain/primitives/notification.primitives';

export class NotificationViewModel extends BaseViewModel {
  public readonly tenantId: string;
  public readonly recipientUserId: string;
  public readonly channel: string;
  public readonly status: string;
  public readonly title: string;
  public readonly body: string;
  public readonly sourceService: string;
  public readonly dedupeKey: string;
  public readonly failureReason: string | null;
  public readonly sentAt: Date | null;
  public readonly readAt: Date | null;
  public readonly cancelledAt: Date | null;

  constructor(props: INotificationPrimitives) {
    super(props.id, props.createdAt, props.updatedAt);
    this.tenantId = props.tenantId;
    this.recipientUserId = props.recipientUserId;
    this.channel = props.channel;
    this.status = props.status;
    this.title = props.title;
    this.body = props.body;
    this.sourceService = props.sourceService;
    this.dedupeKey = props.dedupeKey;
    this.failureReason = props.failureReason;
    this.sentAt = props.sentAt;
    this.readAt = props.readAt;
    this.cancelledAt = props.cancelledAt;
  }
}
