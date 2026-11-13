// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import { boundaryConfigs } from './architecture/eslint-boundaries.mjs';

const HEADLESS = 'The core is headless (CLAUDE.md rule 3)';
const coreBannedGlobals = [
  ...['Date', 'performance'].map((name) => ({
    name,
    message: `${HEADLESS}: no wall clock, use the fixed dt.`,
  })),
  { name: 'console', message: `${HEADLESS}: no console, return data instead.` },
  ...[
    'setTimeout',
    'setInterval',
    'setImmediate',
    'clearTimeout',
    'clearInterval',
    'clearImmediate',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'queueMicrotask',
  ].map((name) => ({ name, message: `${HEADLESS}: no timers, the loop runs on fixed ticks.` })),
  ...[
    'window',
    'document',
    'navigator',
    'location',
    'localStorage',
    'sessionStorage',
    'fetch',
    'XMLHttpRequest',
    'self',
    'globalThis',
    'crypto',
    'process',
    'Buffer',
    'require',
    'module',
    '__dirname',
    '__filename',
  ].map((name) => ({ name, message: `${HEADLESS}: no browser or Node globals.` })),
];

const BOOLEAN_FLAG =
  'Boolean flag parameter: split the function or take an options object (docs/conventions.md).';

export default defineConfig([
  globalIgnores(['dist/', 'coverage/', '.angular/']),
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'max-params': 'off',
      '@typescript-eslint/max-params': ['error', { max: 4 }],
      'no-param-reassign': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':function > Identifier.params[typeAnnotation.typeAnnotation.type="TSBooleanKeyword"]',
          message: BOOLEAN_FLAG,
        },
        {
          selector:
            ':function > AssignmentPattern.params[right.type="Literal"][right.raw=/^(true|false)$/]',
          message: BOOLEAN_FLAG,
        },
      ],
    },
  },
  { files: ['**/*.spec.ts'], rules: { 'max-lines-per-function': 'off' } },
  {
    files: ['src/core/**/*.ts'],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-restricted-globals': ['error', ...coreBannedGlobals],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded Rng from math/ (CLAUDE.md rule 2).',
        },
      ],
    },
  },
  ...boundaryConfigs(),
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  { files: ['**/*.{js,mjs}'], extends: [eslint.configs.recommended] },
]);
