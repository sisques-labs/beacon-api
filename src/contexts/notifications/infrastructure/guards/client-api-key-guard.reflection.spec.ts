import 'reflect-metadata';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Injectable, UseGuards } from '@nestjs/common';

import {
  findClassesMissingGuard,
  NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST,
} from '@contexts/notifications/infrastructure/guards/client-api-key-guard.reflection';
import { ClientApiKeyGuard } from '@contexts/notifications/infrastructure/guards/client-api-key.guard';

/**
 * Fixture proving the check actually DETECTS a violation: a class with no
 * class-level `@UseGuards(ClientApiKeyGuard)` — the exact silent-bypass
 * shape D21 exists to prevent (D21 applies the guard at the CLASS level,
 * unlike the superseded D11 method-level check).
 */
@Injectable()
class FixtureControllerMissingGuard {
  method(): void {
    // Fixture only — never registered with a real module.
  }
}

@Injectable()
@UseGuards(ClientApiKeyGuard)
class FixtureControllerWithGuard {
  method(): void {
    // Fixture only — never registered with a real module.
  }
}

type AnyClass = new (...args: never[]) => unknown;

const TRANSPORT_DIR = join(__dirname, '../../transport');

function collectTransportSourceFiles(dir: string): string[] {
  return (readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[])
    .filter(
      (file) =>
        (file.endsWith('.controller.ts') || file.endsWith('.resolver.ts')) &&
        !file.endsWith('.spec.ts'),
    )
    .map((file) => join(dir, file));
}

async function loadExportedClasses(filePath: string): Promise<AnyClass[]> {
  const moduleExports = (await import(pathToFileURL(filePath).href)) as Record<
    string,
    unknown
  >;
  return Object.values(moduleExports).filter(
    (exported): exported is AnyClass => typeof exported === 'function',
  );
}

describe('findClassesMissingGuard (D21)', () => {
  it('detects a class with no class-level @UseGuards(ClientApiKeyGuard)', () => {
    const violations = findClassesMissingGuard(
      FixtureControllerMissingGuard,
      ClientApiKeyGuard,
      [],
    );

    expect(violations).toEqual([
      { className: 'FixtureControllerMissingGuard' },
    ]);
  });

  it('reports no violation once the class-level guard is present', () => {
    const violations = findClassesMissingGuard(
      FixtureControllerWithGuard,
      ClientApiKeyGuard,
      [],
    );

    expect(violations).toEqual([]);
  });

  it('reports no violation for an allowlisted class, even without the guard', () => {
    const violations = findClassesMissingGuard(
      FixtureControllerMissingGuard,
      ClientApiKeyGuard,
      ['FixtureControllerMissingGuard'],
    );

    expect(violations).toEqual([]);
  });

  it('finds every controller/resolver under notifications/transport/ carries the guard, except the Phase A allowlist', async () => {
    const files = collectTransportSourceFiles(TRANSPORT_DIR);
    expect(files.length).toBeGreaterThan(0);

    const classes = (await Promise.all(files.map(loadExportedClasses))).flat();
    expect(classes.length).toBeGreaterThan(0);

    const violations = classes.flatMap((target) =>
      findClassesMissingGuard(
        target,
        ClientApiKeyGuard,
        NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST,
      ),
    );

    // Every new controller/resolver MUST carry @UseGuards(ClientApiKeyGuard)
    // as it is added (Phases 23/24 onward). Only the Phase A allowlist is
    // exempt, and only until Phase B (28.2/29.3) wires it in.
    expect(violations).toEqual([]);
  });

  it('keeps every Phase A allowlisted class name resolvable under transport/ (no silent allowlist rot)', async () => {
    const files = collectTransportSourceFiles(TRANSPORT_DIR);
    const classes = (await Promise.all(files.map(loadExportedClasses))).flat();
    const classNames = classes.map((target) => target.name);

    for (const allowlistedName of NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST) {
      expect(classNames).toContain(allowlistedName);
    }
  });

  it('keeps every Phase A allowlisted class actually unguarded today, forcing its removal once Phase B wires the guard', async () => {
    const files = collectTransportSourceFiles(TRANSPORT_DIR);
    const classes = (await Promise.all(files.map(loadExportedClasses))).flat();
    const allowlistedClasses = classes.filter((target) =>
      (NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST as readonly string[]).includes(
        target.name,
      ),
    );
    expect(allowlistedClasses.length).toBe(
      NOTIFICATIONS_PHASE_A_GUARD_ALLOWLIST.length,
    );

    for (const target of allowlistedClasses) {
      const violations = findClassesMissingGuard(target, ClientApiKeyGuard, []);
      expect(violations).toEqual([{ className: target.name }]);
    }
  });
});
