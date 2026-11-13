import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { checkImports, findCycle, type RuleName } from './import-rules';
import { ANTI_CHEAT_FORBIDDEN, AUTONOMY_MODULES, CORE_MODULES } from './modules.mjs';
import { importsOf, readSourceFiles } from './source-files';

const root = ts.sys.getCurrentDirectory();

function rulesBrokenBy(path: string, source: string): RuleName[] {
  return checkImports([{ path, imports: importsOf(source) }]).map((broken) => broken.rule);
}

describe('the dependency matrix', () => {
  it('lists exactly the folders in src/core', () => {
    expect(ts.sys.getDirectories(`${root}/src/core`).sort()).toEqual(
      Object.keys(CORE_MODULES).sort(),
    );
  });

  it('has no cycles', () => {
    expect(findCycle(new Map(Object.entries(CORE_MODULES)))).toBeUndefined();
  });

  it('never lets an autonomy module see the truth', () => {
    const leaks = AUTONOMY_MODULES.flatMap((module) =>
      (CORE_MODULES[module] ?? []).filter((dep) => ANTI_CHEAT_FORBIDDEN.includes(dep)),
    );
    expect(leaks).toEqual([]);
  });
});

describe('the codebase', () => {
  it('breaks no import rule', () => {
    expect(checkImports(readSourceFiles(root, ['src', 'bench']))).toEqual([]);
  });
});

describe('each rule fires on its fixture', () => {
  it.each<[RuleName, string, string]>([
    ['anti-cheat', 'src/core/slam/a.ts', "import { step } from '../sim';"],
    ['anti-cheat', 'src/core/slam/a.ts', "import type { Maze } from '../world';"],
    ['anti-cheat', 'src/core/slam/a.ts', "export * from '../eval';"],
    ['anti-cheat', 'src/core/slam/a.ts', "const run = import('../run');"],
    ['anti-cheat', 'src/core/slam/particles/a.ts', "import { step } from '../../sim/index';"],
    ['matrix', 'src/core/math/a.ts', "import { Twist } from '../msgs';"],
    ['index-only', 'src/core/slam/a.ts', "import { Grid } from '../mapping/occupancy-grid';"],
    ['public-api', 'src/app/a.ts', "import { Slam } from '../core/slam';"],
    ['unknown-module', 'src/core/slam/a.ts', "import { x } from '../teleport';"],
    ['core-packages', 'src/core/math/a.ts', "import { signal } from '@angular/core';"],
    ['core-packages', 'src/core/math/a.ts', "import { it } from 'vitest';"],
  ])('%s: %s ← %s', (rule, path, source) => {
    expect(rulesBrokenBy(path, source)).toContain(rule);
  });

  it('cycle', () => {
    const files = [
      { path: 'src/core/math/a.ts', imports: ['./b'] },
      { path: 'src/core/math/b.ts', imports: ['./a'] },
    ];
    expect(checkImports(files).map((broken) => broken.rule)).toEqual(['cycle']);
  });

  it('lets core spec files import the test packages', () => {
    expect(rulesBrokenBy('src/core/math/a.spec.ts', "import fc from 'fast-check';")).toEqual([]);
  });
});
