import { BaseException } from '@sisques-labs/nestjs-kit';

/**
 * Thrown when a `Criteria` filters or sorts on a field that is not part of the
 * aggregate's queryable allowlist (for example the encrypted envelope column).
 */
export class UnsupportedCriteriaFieldException extends BaseException {
  constructor(
    usage: 'filter' | 'sort',
    field: string,
    allowedFields: readonly string[],
  ) {
    super(
      `Cannot ${usage} by '${field}'. Allowed fields: ${allowedFields.join(', ')}`,
    );
  }
}
