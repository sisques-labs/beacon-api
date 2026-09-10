# Changelog

All notable changes to this project will be documented in this file.
## [0.5.0] - 2026-09-09

### Bug Fixes
- **deps:** Pin dependency @kurrent/kurrentdb-client to 1.3.1 (#233) (6bb3f49)
- **deps:** Pin dependency @opentelemetry/semantic-conventions to 1.43.0 (#234) (e1e6695)
- **deps:** Pin dependency @opentelemetry/winston-transport to 0.31.0 (#235) (e8589a8)
- **deps:** Pin dependency @sisques-labs/nestjs-kit to v1.8.0 (#236) (89c3194)
- **deps:** Pin dependency class-transformer to 0.5.1 (#237) (06097d6)
- **deps:** Pin dependency class-validator to 0.15.1 (#238) (c10f872)
- **deps:** Pin dependency dotenv to 17.4.2 (#239) (2ed3c84)
- **deps:** Pin dependency express to 5.2.1 (#240) (d7629c6)
- **deps:** Pin dependency graphql to 17.0.2 (#241) (05ffa6e)
- **deps:** Pin dependency graphql-query-complexity to 2.0.0 (#242) (b9d2251)
- **deps:** Update dependencies in pnpm-lock.yaml (f1dc642)

### Chore
- **deps:** Bump @sisques-labs/nestjs-kit to ^1.10.0 (e2b4055)

### Features
- **auth:** Wire Sisques Account JWT verification into CoreModule (45e3d4c)
## [0.4.0] - 2026-09-04

### Features
- **core:** Wire KurrentDB domain-event forwarding (2a3db30)
## [0.3.0] - 2026-09-01

### Bug Fixes
- **test:** Map @support and @scripts aliases in e2e/integration jest configs (11b8061)

### Chore
- Ignore .claude/worktrees directory in .gitignore (13bbecd)

### Features
- **api:** Enable URI-based API versioning (16f1a06)
- **eslint:** Forbid relative imports in core/contexts/support/database (81d9004)
## [0.2.4] - 2026-08-31

### Bug Fixes
- **deps:** Pin dependency @opentelemetry/api-logs to 0.221.0 (#210) (dcb9ac8)
- **deps:** Pin dependency @opentelemetry/auto-instrumentations-node to 0.79.0 (#211) (4dd92c0)
- **deps:** Pin dependency @opentelemetry/exporter-logs-otlp-proto to 0.221.0 (#212) (14c7cc3)
- **deps:** Pin dependency @opentelemetry/exporter-metrics-otlp-proto to 0.221.0 (#213) (9f9137f)
- **deps:** Pin dependency @opentelemetry/exporter-trace-otlp-proto to 0.221.0 (#214) (4b26452)
- **deps:** Pin dependency @opentelemetry/resources to 2.10.0 (#215) (3f0f61e)
- **deps:** Pin dependency @opentelemetry/sdk-logs to 0.221.0 (#216) (929c8e2)
- **deps:** Pin dependency @opentelemetry/sdk-metrics to 2.10.0 (#217) (24fddb9)
- **deps:** Pin dependency @opentelemetry/sdk-node to 0.221.0 (#218) (bc63658)
- **deps:** Pin dependency @opentelemetry/sdk-trace-base to 2.10.0 (#219) (d85e223)
## [0.2.3] - 2026-08-26

### Bug Fixes
- Disable pnpm engine-identity verification blocking install (38baf2c)
- **deps:** Pin dependency @nestjs/common to 11.1.28 (#191) (6dd563a)
- **deps:** Pin dependency @nestjs/config to 4.0.4 (#192) (d6b7dcc)
- **deps:** Pin dependency @nestjs/core to 11.1.28 (#193) (4f4bcfd)
- **deps:** Pin dependency @nestjs/cqrs to 11.0.3 (#194) (5b99dc0)
- **deps:** Pin dependency @nestjs/graphql to 13.4.2 (#195) (0e5f628)
- **deps:** Pin dependency @nestjs/platform-express to 11.1.28 (#196) (2c7a459)
- **deps:** Pin dependency @nestjs/swagger to 11.4.6 (#197) (797d46f)
- **deps:** Pin dependency @nestjs/terminus to 11.1.1 (#198) (869d3c6)
- **deps:** Pin dependency @nestjs/typeorm to 11.0.3 (#199) (2299c8a)
- **deps:** Pin dependency @opentelemetry/api to 1.9.1 (#200) (927993a)
## [0.2.2] - 2026-08-19

### Bug Fixes
- **deps:** Pin dependency @nestjs/apollo to 12.2.2 (b812183)
- **deps:** Pin dependency @modelcontextprotocol/sdk to 1.30.0 (27f1182)

### Chore
- **deps:** Pin dependency eslint-plugin-prettier to 5.5.6 (#170) (94de4f3)
- **deps:** Pin dependency husky to 9.1.7 (#171) (71374a0)
- **deps:** Pin dependency jest to 30.4.2 (4b50ba2)
- **deps:** Pin dependency lint-staged to 17.3.0 (30f2d7a)
- **deps:** Pin dependency ts-jest to 29.4.12 (5254ca6)
- **deps:** Pin dependency prettier to 3.9.6 (#174) (384fe11)
- **deps:** Pin dependency source-map-support to 0.5.21 (12097cc)
- **deps:** Pin dependency supertest to 7.2.2 (abffc0e)
- **deps:** Pin dependency ts-loader to 9.6.2 (4c32ed1)
- **deps:** Pin dependency ts-node to 10.9.2 (19c7b26)
- **deps:** Pin dependency tsconfig-paths to 4.2.0 (#182) (e97d70c)
- **deps:** Pin dependency typescript to 6.0.3 (#183) (c8050a9)
- **deps:** Pin node.js to v24.19.0 (#184) (2d57e08)
## [0.2.1] - 2026-08-10

### Chore
- **deps:** Lock file maintenance (#117) (15b468c)
- **deps:** Update dependency @sisques-labs/nestjs-kit to v1.6.1 (#127) (3427695)
- **deps:** Update prom/prometheus docker tag to v3.13.2 (4a29541)
- **deps:** Update pnpm to v11.21.0 (f70e7fb)
- **deps:** Update otel/opentelemetry-collector-contrib docker tag to v0.158.0 (4dc5979)
- **deps:** Update jaegertracing/all-in-one docker tag to v1.76.0 (dd14cd7)
- **deps:** Pin dependency @nestjs/cli to 11.0.24 (a2816a3)
- **deps:** Pin dependency @testcontainers/postgresql to 12.0.4 (6b9b37d)
- **deps:** Pin dependency @nestjs/schematics to 11.1.0 (2cd9998)
- **deps:** Pin dependency @nestjs/testing to 11.1.28 (d7b5718)
- **deps:** Pin dependency @typescript-eslint/eslint-plugin to 8.65.0 (2875929)
- **deps:** Pin dependency @typescript-eslint/parser to 8.65.0 (6214855)
- **deps:** Pin dependency eslint-config-prettier to 10.1.8 (fee65f4)
- **deps:** Pin dependency eslint-import-resolver-typescript to 4.4.5 (ca8c1ec)
- **deps:** Pin dependency eslint-plugin-boundaries to 7.1.0 (e29f918)
- **deps:** Pin dependency eslint to 8.57.1 (576467b)
## [0.2.0] - 2026-08-09

### Features
- **observability:** Replace Sentry and Prometheus with OpenTelemetry (e82a8f2)
- **observability:** Forward logs through the OpenTelemetry pipeline (2a129dd)
## [0.1.14] - 2026-08-07

### Testing
- Enforce 80% coverage threshold and close coverage gaps (350a002)
- Exclude structural, logic-free files from coverage collection (4db16fc)
## [0.1.13] - 2026-08-03

### Chore
- **deps:** Update dependency @sisques-labs/nestjs-kit to v1.5.1 (#112) (8995d6b)
- **deps:** Lock file maintenance (#115) (f69e919)
- **deps:** Update dependency lint-staged to v17.3.0 (45c4cb8)
- **deps:** Update pnpm to v11.18.0 (8083d83)
## [0.1.12] - 2026-07-29

### Bug Fixes
- **ci:** Fix docker build and e2e TS6 fallout from pnpm 11/TS6 migration (d9ed0c4)

### Chore
- Migrate to pnpm 11 and TypeScript 6 (693b2c1)

### Refactor
- Use a dedicated tsconfig for gen:topics instead of inline -O JSON (f22b3bf)
## [0.1.11] - 2026-07-29

### Bug Fixes
- **deps:** Update dependency graphql-query-complexity to v2 (f7243ce)

### Chore
- **deps:** Update dependency ts-jest to v29.4.12 (c5ea68f)
- **deps:** Update dependency prettier to v3.9.6 (cd6872a)
- **deps:** Lock file maintenance (#102) (1106dcf)
## [0.1.10] - 2026-07-28

### Bug Fixes
- **docker:** Drop global npm from runner image to clear CVE-2026-59873 (26bd63f)
- **docker:** Correct Dockerfile content (previous commit wrote base64-encoded text) (c5cf4dd)
## [0.1.9] - 2026-07-20

### Chore
- **deps:** Update dependency @sisques-labs/nestjs-kit to v1.5.0 (23b5108)
- **deps:** Update dependency lint-staged to v17.1.0 (f235a68)
- **deps:** Lock file maintenance (b430604)
- **deps:** Lock file maintenance (3393417)
## [0.1.8] - 2026-07-17

### CI
- **release:** Scan Docker image for vulnerabilities with Trivy (94420ac)
- Parallelize lint/test/build via node-ci, decouple e2e/integration (ef978ca)
- **docker:** Block PR merge on CRITICAL image vulnerabilities (14a10ae)
## [0.1.7] - 2026-07-17

### CI
- **labeler:** Auto-label PRs by changed files (7dbc2da)
- **release-train:** Sync dependabot/updates after stable release (0b237ca)
## [0.1.6] - 2026-07-17

### Bug Fixes
- **deps:** Update dependency @nestjs/core to v11 [security] (8ba73b4)
- **deps:** Update dependency @nestjs/swagger to v11 (7c64121)
- **deps:** Update dependency @nestjs/graphql to v13 (69b71a9)
- **deps:** Update dependency class-validator to ^0.15.0 (9ee5e24)
- **deps:** Update dependency @nestjs/platform-express to v11 (fdce341)
- **deps:** Update dependency @nestjs/common to v11 (6bb2af2)
- **deps:** Update dependency graphql to v17 (b87943c)

### Chore
- **deps:** Update node.js to v24 (d0c7aef)
- **deps:** Lock file maintenance (0d81785)
- **deps:** Update pnpm to v9.15.9 (41b881f)
- **deps:** Update postgres docker tag to v18 (49c7a3d)
- **deps:** Update dependency @nestjs/testing to v11 (d0ffd49)
## [0.1.5] - 2026-07-17

### CI
- **security:** Add CodeQL analysis workflow (9ae1a69)
## [0.1.4] - 2026-07-15

### Chore
- Extend shared Renovate config, remove Dependabot (a0275ae)
## [0.1.3] - 2026-07-15

### Chore
- **deps-dev:** Bump @typescript-eslint/eslint-plugin (5149f34)
## [0.1.2] - 2026-07-15

### Chore
- **deps:** Bump @nestjs/cqrs from 10.2.8 to 11.0.3 (2eda514)
- **deps-dev:** Bump @typescript-eslint/parser from 8.63.0 to 8.64.0 (f5a5f8c)
- **deps:** Bump @nestjs/terminus from 10.3.0 to 11.1.1 (d1a1b3e)
- **deps-dev:** Bump @nestjs/cli from 11.0.23 to 11.0.24 (1a3972c)
- **deps-dev:** Bump @types/supertest from 7.2.0 to 7.2.1 (67c16b3)
- **deps:** Bump docker/setup-qemu-action from 3 to 4 (1bd4468)
- **deps:** Bump docker/setup-buildx-action from 3 to 4 (0057997)
- **deps:** Bump @sisques-labs/nestjs-kit from 1.2.1 to 1.3.1 (007d140)
- **deps-dev:** Bump eslint-plugin-boundaries from 6.0.2 to 7.0.2 (fb197f7)
- **deps:** Bump docker/build-push-action from 6 to 7 (000a209)
- **deps:** Bump actions/checkout from 4 to 7 (a76e062)
- **deps:** Bump typeorm from 1.0.0 to 1.1.0 (2cbea3b)
## [0.1.1] - 2026-07-10

### Chore
- **deps-dev:** Bump @types/supertest from 6.0.3 to 7.2.0 (98f7a65)
- **deps-dev:** Bump jest and @types/jest (7023af8)
- **deps-dev:** Bump eslint-config-prettier from 9.1.2 to 10.1.8 (b94aa03)
- **deps-dev:** Bump @nestjs/schematics from 10.2.3 to 11.1.0 (0d880d6)
## [0.1.0] - 2026-07-10

### Chore
- First commit (19b9436)
- Rename package to sisqueslabs/nestjs-template (41f38b4)
- **deps:** Bump @sisques-labs/nestjs-kit to 1.2.1 (5d7cc08)
- Reset package.json version to 0.0.0 (cc5fcde)

### Documentation
- Add docker/README.md for the Docker Hub repository page (efffab5)

### Features
- Bootstrap NestJS service template from gardenia-api conventions (7f53cea)

### Refactor
- **mcp:** Consume @sisques-labs/nestjs-kit/mcp instead of a local copy (34388a4)
- **metrics,messaging:** Consume @sisques-labs/nestjs-kit instead of local copies (10287b5)
- Aggregate core/context wiring into CoreModule/ContextsModule (6885b77)

