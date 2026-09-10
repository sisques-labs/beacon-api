import { BasePrimitives } from '@sisques-labs/nestjs-kit';

export type INotificationPrimitives = BasePrimitives & {
  tenantId: string;
  recipientUserId: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  sourceService: string;
  dedupeKey: string;
  failureReason: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  cancelledAt: Date | null;
};
