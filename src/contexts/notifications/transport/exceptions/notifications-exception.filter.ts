import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { InvalidDiscordWebhookUrlException } from '@contexts/notifications/domain/exceptions/invalid-discord-webhook-url.exception';
import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';
import { UnsupportedDestinationChannelException } from '@contexts/notifications/domain/exceptions/unsupported-destination-channel.exception';

/**
 * Per-context HTTP status resolver for `notifications` exceptions, wired
 * into `EXCEPTION_STATUS_RESOLVERS` in `core/filters/base-exception.filter.ts`.
 * `BaseExceptionFilter` reuses this same resolved status for both the HTTP
 * and GraphQL branches, so mapping an exception here covers both transports.
 */
export function resolveNotificationsExceptionStatus(
  exception: BaseException,
): number | undefined {
  if (exception instanceof NotificationNotFoundException) {
    return HttpStatus.NOT_FOUND;
  }
  if (
    exception instanceof InvalidDiscordWebhookUrlException ||
    exception instanceof UnsupportedDestinationChannelException
  ) {
    return HttpStatus.BAD_REQUEST;
  }
  return undefined;
}
