import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { NotificationChannelEnum } from '@contexts/notifications/domain/enums/notification-channel.enum';
import { DiscordWebhookUrlValueObject } from '@contexts/notifications/domain/value-objects/discord-webhook-url/discord-webhook-url.value-object';

/**
 * `webhookUrl` is a plain string here — no URL-format validator. The SSRF
 * allowlist validation (D7/D8) happens once, in `DiscordWebhookUrlValueObject`,
 * so it is not duplicated in a transport-level validator.
 */
@InputType()
export class NotificationChannelDestinationRegisterRequestDto {
  @Field(() => NotificationChannelEnum)
  @IsEnum(NotificationChannelEnum)
  channel!: NotificationChannelEnum;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DiscordWebhookUrlValueObject.MAX_LENGTH)
  webhookUrl!: string;
}
