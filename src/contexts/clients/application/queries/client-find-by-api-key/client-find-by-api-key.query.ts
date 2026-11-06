export interface ClientFindByApiKeyQueryInput {
  apiKey: string;
}

/**
 * Carries the raw presented credential as-is, deliberately NOT wrapped in
 * a value object. A malformed, unknown, mismatched, or revoked key MUST
 * resolve to `null` (design.md D17), never throw a constructor validation
 * exception the way a UUID/enum-backed query VO would — format parsing and
 * the constant-time comparison both live in
 * `AuthenticateClientApiKeyService`, which this query only delegates to.
 */
export class ClientFindByApiKeyQuery {
  public readonly apiKey: string;

  constructor(input: ClientFindByApiKeyQueryInput) {
    this.apiKey = input.apiKey;
  }
}
