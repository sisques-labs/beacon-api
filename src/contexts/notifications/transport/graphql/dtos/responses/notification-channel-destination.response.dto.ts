import { Field, ID, ObjectType } from '@nestjs/graphql';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';

/**
 * Metadata-only read (D10, spec: "Metadata-Only Reads"). Never carries the
 * webhook URL, plaintext or ciphertext, in any field.
 */
@ObjectType('NotificationChannelDestinationResponseDto')
export class NotificationChannelDestinationResponseDto {
  @Field()
  configured!: boolean;

  @Field(() => ID, { nullable: true })
  id?: string;

  @Field(() => NotificationChannelEnum, { nullable: true })
  channel?: NotificationChannelEnum;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date;
}
