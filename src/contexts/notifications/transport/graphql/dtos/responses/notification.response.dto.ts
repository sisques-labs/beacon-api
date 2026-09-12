import { Field, ID, ObjectType } from '@nestjs/graphql';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { NotificationStatusEnum } from '@contexts/notifications/domain/enums/notification-status.enum';

@ObjectType('NotificationResponseDto')
export class NotificationResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  tenantId!: string;

  @Field(() => ID)
  recipientUserId!: string;

  @Field(() => NotificationChannelEnum)
  channel!: NotificationChannelEnum;

  @Field(() => NotificationStatusEnum)
  status!: NotificationStatusEnum;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field()
  sourceService!: string;

  @Field()
  dedupeKey!: string;

  @Field(() => String, { nullable: true })
  failureReason!: string | null;

  @Field(() => Date, { nullable: true })
  sentAt!: Date | null;

  @Field(() => Date, { nullable: true })
  readAt!: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
