import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { DiscordWebhookUrlValueObject } from '@contexts/notifications/domain/value-objects/discord-webhook-url/discord-webhook-url.value-object';

/**
 * `webhookUrl` is a plain string here — no `@IsUrl`. The SSRF allowlist
 * validation (D7/D8) happens once, in `DiscordWebhookUrlValueObject`, so it
 * is not duplicated in a transport-level validator.
 */
export class NotificationChannelDestinationRegisterRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(DiscordWebhookUrlValueObject.MAX_LENGTH)
  webhookUrl!: string;
}
