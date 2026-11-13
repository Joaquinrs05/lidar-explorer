// @ts-check
import { CORE_MODULES, PUBLIC_MODULES } from './modules.mjs';

const CORE_NAMES = Object.keys(CORE_MODULES);
const NOT_AN_INDEX = '(?!index(\\.[jt]s)?$)';

/** @param {string} name @param {readonly string[]} allowed */
function modulePatterns(name, allowed) {
  const others = CORE_NAMES.filter((module) => module !== name);
  const forbidden = others.filter((module) => !allowed.includes(module));
  const deepImport = {
    regex: `^(\\.\\./)+(${others.join('|')})/${NOT_AN_INDEX}`,
    message: 'Import another core module only through its index.ts.',
  };
  if (forbidden.length === 0) return [deepImport];
  const matrix = {
    regex: `^(\\.\\./)+(${forbidden.join('|')})(/|$)`,
    message: `${name} may import only: ${allowed.join(', ') || 'no other module'} (architecture/modules.mjs).`,
  };
  return [matrix, deepImport];
}

/** ESLint configs that enforce the dependency matrix with no-restricted-imports. */
export function boundaryConfigs() {
  const core = Object.entries(CORE_MODULES).map(([name, allowed]) => ({
    files: [`src/core/${name}/**/*.ts`],
    rules: { 'no-restricted-imports': ['error', { patterns: modulePatterns(name, allowed) }] },
  }));
  const outside = {
    files: ['src/**/*.ts', 'bench/**/*.ts'],
    ignores: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^(\\.{1,2}/)+core/(?!(${PUBLIC_MODULES.join('|')})(/index(\\.[jt]s)?)?$)`,
              message: `Outside the core, import only ${PUBLIC_MODULES.join(' and ')}, through their index.ts.`,
            },
          ],
        },
      ],
    },
  };
  return [...core, outside];
}
