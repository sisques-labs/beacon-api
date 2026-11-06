# `clients` bounded context

Owns per-client API key identity, 1:1 with `tenantId`. Every key is issued,
rotated and revoked through a CLI, and only a hash of it is ever persisted.
See `openspec/changes/per-client-discord-webhook/design.md` (D14–D20) for
the full rationale.

## Domain

- `ClientAggregate` — fields: `tenantId`, `name`, `apiKeyId`,
  `apiKeySecretHash`, `apiKeyRotatedAt?`, `revokedAt?`. Methods:
  `create()`, `rotateApiKey(apiKeyId, apiKeySecretHash)`, `revoke()`.
  `rotateApiKey()`/`revoke()` on an already-revoked client throw
  `ClientRevokedException` (D18/D19) — revocation is terminal, there is no
  un-revoke.
- Events (`ClientCreated`, `ClientApiKeyRotated`, `ClientRevoked`) carry
  metadata only — `id`, `tenantId`, `name`, `apiKeyId`, timestamps — never
  the hash (D15, mirrors `notifications`' D9).
- `ClientBuilder` constructs the aggregate and `ClientViewModel` from
  primitives; the view model also excludes `apiKeySecretHash`.

## API key format (D16) and hashing/lookup (D17)

- Issued key: `bcn_{keyId}_{secret}`, 64 characters total —
  `keyId` is 16 lowercase-hex characters (8 random bytes, public, used for
  lookup), `secret` is 43 base64url characters (32 random bytes, 256 bits).
  Regex: `^bcn_([0-9a-f]{16})_([A-Za-z0-9_-]{43})$`.
- `RandomApiKeyGeneratorAdapter` (`IApiKeyGeneratorPort`) generates the pair;
  `Sha256ApiKeyHasherAdapter` (`IApiKeyHasherPort`) hashes `secret` to a hex
  `char(64)` digest, stored as `apiKeySecretHash`. The plaintext key is never
  persisted or logged.
- Lookup uses the unique `apiKeyId` index (`IClientWriteRepository.findByApiKeyId`).
  `AuthenticateClientApiKeyService` (`application/services/write/`) parses
  the credential against the D16 regex, hashes the presented secret, and
  compares with `crypto.timingSafeEqual` against the stored hash — or a
  fixed dummy hash when `keyId` is unknown, so an unknown key costs the same
  work as a known one (no timing oracle). Every failure — malformed,
  unknown, mismatched, or revoked — resolves to `null`; only an
  infrastructure error propagates as a thrown error.
- `ClientFindByApiKeyQuery`/`Handler` is a thin delegate to that service —
  the entry point other contexts dispatch through the `QueryBus` (see
  `notifications/application/ports/client-authentication.port.ts`).

## Rotation and revocation (D18/D19)

- **Rotation is immediate**: `RotateClientApiKeyCommand` generates a new
  `keyId`+`secret` pair, hashes it, calls `rotateApiKey()`, and prints the
  new key once. The prior key fails on its very next use — no overlap
  window.
- **Revocation is terminal**: `RevokeClientCommand` calls `revoke()`, which
  sets `revokedAt`. There is no un-revoke command. Re-issuing access for the
  same `tenantId` requires running `client:create --tenant-id <same>` again,
  allowed by the partial unique index `(tenantId) WHERE "revokedAt" IS NULL
AND "deletedAt" IS NULL` — `apiKeyId` stays unique across all rows, so key
  ids are never reused.

## CLI (D20) — no HTTP surface

`src/cli.ts` boots `ClientsCliModule` as a Nest standalone application
context (`NestFactory.createApplicationContext`) — no HTTP, GraphQL, Kafka,
or BullMQ. `ClientsCliRunner` (`transport/cli/`) parses argv with `node:util`
`parseArgs` and dispatches exclusively through `CommandBus`/`QueryBus`. A
generated/rotated key is written to stdout exactly once and alone, so it can
be piped straight into a secret manager; confirmations and usage errors go
to stderr; the plaintext key is never logged.

```sh
pnpm client:create --name <name> [--tenant-id <uuid>]  # tenantId defaults to a new UUID
pnpm client:rotate --client-id <id>
pnpm client:revoke --client-id <id>
pnpm client:list
```

Each script runs `node dist/cli.js <command>` (build first with `pnpm
build`). `list` prints one line per client — `id`, `tenantId`, `name`,
`apiKeyId`, and `active`/`revoked` — never the secret or its hash.

**Privilege**: running the CLI requires runtime exec access plus database
credentials; there is no HTTP route that mints or lists keys.

## Out of scope for this context

- No HTTP, GraphQL, Kafka, or MCP transport — CLI only.
- No key overlap window on rotation, and no un-revoke (D18/D19, deliberate).
- Login/session flows — a client is an API key holder, not a user account.
