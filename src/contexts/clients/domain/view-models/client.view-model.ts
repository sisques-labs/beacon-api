import { BaseViewModel } from '@sisques-labs/nestjs-kit';

/**
 * Read-side projection for `client` (D17, mirrors D10). It deliberately has
 * NO `apiKeySecretHash` field — a read can never return the secret hash in
 * any form.
 */
export class ClientViewModel extends BaseViewModel {
  public readonly tenantId: string;
  public readonly name: string;
  public readonly apiKeyId: string;
  public readonly apiKeyRotatedAt: Date | null;
  public readonly revokedAt: Date | null;

  constructor(props: {
    id: string;
    tenantId: string;
    name: string;
    apiKeyId: string;
    apiKeyRotatedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    super(props.id, props.createdAt, props.updatedAt);
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.apiKeyId = props.apiKeyId;
    this.apiKeyRotatedAt = props.apiKeyRotatedAt;
    this.revokedAt = props.revokedAt;
  }
}
