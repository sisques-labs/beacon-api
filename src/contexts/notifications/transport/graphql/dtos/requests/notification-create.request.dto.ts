import { Field, InputType, ID } from '@nestjs/graphql';
import { IsEnum, IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

@InputType()
export class NotificationCreateRequestDto {
  @Field(() => ID)
  @IsUUID()
  tenantId!: string;

  @Field(() => ID)
  @IsUUID()
  recipientUserId!: string;

  // D5: the domain enum is exposed, but the write path only accepts DISCORD —
  // delivery has no channel branch, every created notification is sent to
  // Discord, so EMAIL/PUSH are rejected explicitly rather than silently
  // mis-delivered.
  @Field(() => NotificationChannelEnum)
  @IsEnum(NotificationChannelEnum)
  @IsIn([NotificationChannelEnum.DISCORD])
  channel!: NotificationChannelEnum;

  @Field()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  sourceService!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  dedupeKey!: string;
}
