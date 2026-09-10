import { defineConfig, mergeConfig } from 'vitest/config';

import shared from './vitest.shared.mts';

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      include: ['test/integration/**/*.integration-spec.ts'],
      setupFiles: ['./test/helpers/env-setup.ts'],
      globalSetup: ['./test/global-setup.ts'],
      testTimeout: 30000,
      fileParallelism: false,
      passWithNoTests: true,
    },
  }),
);
