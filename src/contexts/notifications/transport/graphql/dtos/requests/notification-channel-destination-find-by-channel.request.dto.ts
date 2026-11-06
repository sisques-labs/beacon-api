import { Field, InputType } from '@nestjs/graphql';
import { IsEnum } from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

@InputType()
export class NotificationChannelDestinationFindByChannelRequestDto {
  @Field(() => NotificationChannelEnum)
  @IsEnum(NotificationChannelEnum)
  channel!: NotificationChannelEnum;
}
