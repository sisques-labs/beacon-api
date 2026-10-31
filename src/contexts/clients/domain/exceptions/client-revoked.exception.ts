import { BaseException } from '@sisques-labs/nestjs-kit';

export class ClientRevokedException extends BaseException {
  constructor() {
    super('Client is revoked');
  }
}
