import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Sends a GraphQL request to the running app.
 *
 * @param app    - The bootstrapped NestJS application
 * @param query  - GraphQL operation string (query or mutation)
 * @param variables - Optional variables map
 * @param headers - Optional extra headers (e.g. `x-api-key`)
 */
export function gql(
  app: INestApplication,
  query: string,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>,
): request.Test {
  let req = request(app.getHttpServer())
    .post('/graphql')
    .send({ query, variables: variables ?? {} });

  for (const [name, value] of Object.entries(headers ?? {})) {
    req = req.set(name, value);
  }

  return req;
}
