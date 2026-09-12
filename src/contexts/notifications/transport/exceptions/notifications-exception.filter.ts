import { HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';

import { NotificationNotFoundException } from '@contexts/notifications/domain/exceptions/notification-not-found.exception';

/**
 * Per-context HTTP status resolver for `notifications` exceptions, wired
 * into `EXCEPTION_STATUS_RESOLVERS` in `core/filters/base-exception.filter.ts`.
 */
export function resolveNotificationsExceptionStatus(
  exception: BaseException,
): number | undefined {
  if (exception instanceof NotificationNotFoundException) {
    return HttpStatus.NOT_FOUND;
  }
  return undefined;
}
