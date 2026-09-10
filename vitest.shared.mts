import swc from 'unplugin-swc';
import { coverageConfigDefaults, defineConfig } from 'vitest/config';

// Shared by vitest.config.mts, vitest.integration.config.mts and
// vitest.e2e.config.mts. NestJS relies on emitDecoratorMetadata for DI, which
// esbuild (Vite's default transformer) cannot produce — swc is used instead.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
        keepClassNames: true,
      },
      module: { type: 'es6' },
      sourceMaps: true,
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/main.ts',
        'src/telemetry.ts',
        'src/**/*.module.ts',
        'src/database/data-source.ts',
        'src/**/*.interface.ts',
        'src/**/*.primitives.ts',
        'src/**/*.entity.ts',
        'src/**/*.dto.ts',
        'src/**/*.input.ts',
        'src/**/*.object.ts',
        'src/**/*.view-model.ts',
        'src/**/*.enum.ts',
        'src/**/*.generated.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
