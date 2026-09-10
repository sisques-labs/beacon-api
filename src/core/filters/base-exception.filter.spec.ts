import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseException } from '@sisques-labs/nestjs-kit';
import { vi } from 'vitest';

import { BaseExceptionFilter } from '@core/filters/base-exception.filter';

class SampleDomainException extends BaseException {
  constructor() {
    super('Something went wrong');
  }
}

const buildHttpHost = (statusFn = vi.fn(), jsonFn = vi.fn()): ArgumentsHost => {
  const response = {
    status: vi.fn().mockReturnValue({ json: jsonFn }),
  };
  statusFn.mockReturnValue({ json: jsonFn });
  response.status = statusFn;

  return {
    getType: vi.fn().mockReturnValue('http'),
    switchToHttp: vi.fn().mockReturnValue({
      getResponse: vi.fn().mockReturnValue(response),
    }),
  } as unknown as ArgumentsHost;
};

describe('BaseExceptionFilter', () => {
  let filter: BaseExceptionFilter;

  beforeEach(() => {
    filter = new BaseExceptionFilter();
  });

  describe('catch() — HTTP host', () => {
    it('defaults to 400 for an unrecognized BaseException', () => {
      const statusFn = vi.fn().mockReturnValue({ json: vi.fn() });
      const host = buildHttpHost(statusFn);

      filter.catch(new SampleDomainException(), host);

      expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('writes the exception message in the JSON response body', () => {
      const jsonFn = vi.fn();
      const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
      const host = buildHttpHost(statusFn, jsonFn);
      const exception = new SampleDomainException();

      filter.catch(exception, host);

      expect(jsonFn).toHaveBeenCalledWith(
        expect.objectContaining({ message: exception.message }),
      );
    });
  });

  describe('catch() — GraphQL host', () => {
    it('throws a GraphQLError for GraphQL', () => {
      const host = {
        getType: vi.fn().mockReturnValue('graphql'),
      } as unknown as ArgumentsHost;

      expect(() => filter.catch(new SampleDomainException(), host)).toThrow();
    });

    it('sets extensions.code to the exception class name', () => {
      const host = {
        getType: vi.fn().mockReturnValue('graphql'),
      } as unknown as ArgumentsHost;

      const exception = new SampleDomainException();

      try {
        filter.catch(exception, host);
        throw new Error('expected filter.catch to throw');
      } catch (e: any) {
        expect(e.extensions.code).toBe('SampleDomainException');
        expect(e.extensions.statusCode).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('preserves the exception message', () => {
      const host = {
        getType: vi.fn().mockReturnValue('graphql'),
      } as unknown as ArgumentsHost;

      const exception = new SampleDomainException();

      try {
        filter.catch(exception, host);
        throw new Error('expected filter.catch to throw');
      } catch (e: any) {
        expect(e.message).toBe(exception.message);
      }
    });
  });
});
