import { BaseException } from '@sisques-labs/nestjs-kit';

export class ClientNotFoundException extends BaseException {
  constructor() {
    super('Client was not found');
  }
}
