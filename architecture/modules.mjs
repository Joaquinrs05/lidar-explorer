// @ts-check
/**
 * The dependency matrix of `src/core`: each module and the modules it may import.
 * The single source of truth for the ESLint boundaries and for architecture.spec.ts.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const CORE_MODULES = Object.freeze({
  math: [],
  msgs: ['math'],
  driver: ['msgs'],
  world: ['math'],
  sim: ['math', 'msgs', 'world', 'driver'],
  mapping: ['math', 'msgs'],
  localization: ['math', 'msgs', 'mapping'],
  slam: ['math', 'msgs', 'mapping', 'localization'],
  planning: ['math', 'msgs', 'mapping'],
  control: ['math', 'msgs'],
  exploration: ['math', 'msgs', 'mapping', 'planning'],
  autonomy: ['math', 'msgs', 'driver', 'slam', 'planning', 'control', 'exploration'],
  eval: ['math', 'msgs', 'world', 'mapping'],
  run: [
    'math',
    'msgs',
    'driver',
    'world',
    'sim',
    'mapping',
    'localization',
    'slam',
    'planning',
    'control',
    'exploration',
    'autonomy',
    'eval',
  ],
});

/** The modules that make up the robot's autonomy. */
export const AUTONOMY_MODULES = Object.freeze([
  'mapping',
  'localization',
  'slam',
  'planning',
  'control',
  'exploration',
  'autonomy',
]);

/** The modules the anti-cheat rule hides from autonomy: they know the true pose or the true maze. */
export const ANTI_CHEAT_FORBIDDEN = Object.freeze(['sim', 'world', 'eval', 'run']);

/** The only core modules that code outside `src/core` may import. */
export const PUBLIC_MODULES = Object.freeze(['run', 'msgs']);

/** The packages core spec files may import. Production core code imports no package. */
export const CORE_TEST_PACKAGES = Object.freeze(['vitest', 'fast-check']);
