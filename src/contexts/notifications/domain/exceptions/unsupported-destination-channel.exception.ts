import { BaseException } from '@sisques-labs/nestjs-kit';

export class UnsupportedDestinationChannelException extends BaseException {
  constructor() {
    super(
      'Registering a notification channel destination is only supported for the DISCORD channel.',
    );
  }
}
