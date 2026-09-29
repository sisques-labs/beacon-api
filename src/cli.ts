import { NestFactory } from '@nestjs/core';

import { ClientsCliModule } from '@contexts/clients/transport/cli/clients-cli.module';
import { ClientsCliRunner } from '@contexts/clients/transport/cli/clients-cli.runner';

/**
 * Standalone Nest application-context CLI entry point (design.md D20). Only
 * `error`/`warn` Nest logging is enabled so bootstrap noise never lands on
 * stdout — `ClientsCliRunner` writes the generated/rotated API key to
 * stdout exactly once, alone, so it can be piped straight into a secret
 * manager.
 */
async function bootstrap(): Promise<number> {
  const app = await NestFactory.createApplicationContext(ClientsCliModule, {
    logger: ['error', 'warn'],
  });

  try {
    const runner = app.get(ClientsCliRunner);
    return await runner.run(process.argv.slice(2));
  } finally {
    await app.close();
  }
}

bootstrap()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`Failed to run the CLI: ${String(error)}\n`);
    process.exitCode = 1;
  });
