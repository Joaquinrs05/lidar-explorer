# F0 · Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, run inline as `CLAUDE.md` requires (subagent-driven development only if the owner asks for it). Steps use checkbox (`- [ ]`) syntax for tracking. `CLAUDE.md` overrides the skill's pacing: **after every task's commit, stop and report to the owner in Spanish** (what changed, how to see it, a 3-line interview explanation and one interview question), then wait for "sigue". Each task ends with a **Show the owner** line for that report.

**Goal:** Build F0's foundations: an Angular 22 app on Node 26, a pure-TypeScript core with strict typing, clean-code lint limits, Vitest and fast-check, mechanical architecture guardrails (the dependency matrix and the anti-cheat rule), the docs, CI with Vercel previews, and the first domain code (angle helpers and `Pose2D`).

**Architecture:** One dependency matrix, `architecture/modules.mjs`, feeds two independent guards: an ESLint `no-restricted-imports` rule and an architecture test that resolves real import paths with the TypeScript compiler API. The core compiles in its own project, `tsconfig.core.json`, with the ES2022 library only (no DOM, no Node), and Vitest tests it in Node behind a 90 % coverage gate. `ng test` (Vitest with jsdom) tests the Angular app.

**Tech Stack:** Node 26 LTS · npm 12 locally (CI uses the npm 11 bundled with Node 26; both use lockfile v3) · Angular 22.2 (CLI 22.2.7) · TypeScript 6.0 · ESLint 10, typescript-eslint 8, angular-eslint 22.6 · Vitest 5.1 with @vitest/coverage-v8 · fast-check 4.10 · Prettier 3 · GitHub Actions · Vercel.

**Spec:** `docs/superpowers/specs/2026-11-13-f0-foundations-design.md`

## Global Constraints

Copied from `CLAUDE.md`:

- Hard rules 1–9 of `CLAUDE.md`:
  1. **Anti-cheat.** The autonomy modules (`mapping`, `localization`, `slam`, `planning`, `control`, `exploration`, `autonomy`) never import `sim`, `world`, `eval` or `run`. The robot never sees the true pose or the true maze.
  2. **Seed everything.** No `Math.random()` in `src/core/`. Use the seeded `Rng` from `math/` and `fork()` one stream per subsystem. The same seed gives the same run (`?seed=42`).
  3. **Headless core.** No DOM, no timers, no wall clock and no `console` in `src/core/`. The time step `dt` is fixed. The UI only renders snapshots.
  4. **Units and frames.**
     - SI units everywhere in the core. Anything non-SI carries a unit suffix, such as `angleDeg`.
     - Frames follow ROS REP-103.
     - Angles are normalized to (−π, π] and averaged circularly.
     - The canvas y-flip happens only in the renderer.
  5. **ROS 2-shaped messages** in `msgs/`: `LaserScan`, `Odometry`, `OccupancyGrid`, `Twist`, `PoseArray`, `Path`.
  6. **Interfaces only at real seams:** the driver ports, `GroundTruthSource`, `Rng`, `SimulationPort` and `BenchResultsRepository`. Any other abstraction waits for its second implementation.
  7. **No new dependency** without the owner's approval.
  8. **Never weaken a guardrail** to get green: a lint rule, tsconfig strictness, a coverage threshold, the dependency matrix or CI. If one blocks you, stop and explain.
  9. **Lidar parameters** come from the RPLIDAR C1 datasheet. Verify them; never guess.
- **Definition of Done for each task:**
  - tests written first and seen failing;
  - `npm run verify` green, once it exists;
  - TSDoc on every export of a module's `index.ts`;
  - the core coverage threshold met;
  - one conventional commit, `type(scope): summary`, where the scope is the module, with a `Co-Authored-By` trailer.
- **Clean code limits enforced by ESLint:** functions of at most 40 lines, at most 4 parameters (otherwise an options object) and cyclomatic complexity of at most 10.

F0 specifics, checked on 2026-11-13 against the npm registry, nodejs.org, Vercel's docs and a throwaway prototype of Tasks 1–4 and 7:

- **Runtime: Node 26 LTS** ("Lithium", 26.13 today). Angular 22.2 accepts `^22.22.3 || ^24.15.0 || >=26.0.0`, and Vercel offers `26.x` (its default), so neither `fnm` nor Node 24 is needed. `.nvmrc` holds `26`; `package.json` has `"engines": { "node": "26.x" }`.
- **TypeScript stays on 6.0.** Angular 22 requires `>=6.0 <6.1`; never take TypeScript 7.
- **Exact versions:** `.npmrc` has `save-exact=true`, and every version in `package.json` is exact (no `^` or `~`).
- **Approved dependencies.** Anything else needs the owner:
  - from `ng new`: `@angular/common`, `@angular/compiler`, `@angular/core`, `@angular/forms`, `@angular/platform-browser`, `@angular/router`, `rxjs`, `tslib`, `@angular/build`, `@angular/cli`, `@angular/compiler-cli`, `jsdom`, `prettier`, `typescript`, `vitest`;
  - from `ng add angular-eslint@22.6.0`: `angular-eslint`, `eslint`, `@eslint/js`, `typescript-eslint`;
  - `@vitest/coverage-v8` (the same version as `vitest`) and `fast-check@4.10.2`;
  - no `@types/node`: tooling code reads files through `ts.sys`.
- **ESM repo:** `package.json` has `"type": "module"`, and config files use `import`.
- **npm 12 blocks dependency install scripts** (`esbuild`, `lmdb`, `@parcel/watcher`, `msgpackr-extract`). The warning is expected, and the build and the tests work without those scripts. Do not approve them without the owner.
- **Build output:** `dist/lidar-explorer/browser`.
- **Permission prompts:** `npm install`, `git push` and `gh pr` ask the owner (`.claude/settings.json`). The prompt is the owner's gate, not a blocker.

## Review Focus

Copied from `CLAUDE.md`:

- **SOLID and clean code:**
  - one responsibility per module and per class;
  - extension through ports, not edits to `autonomy`;
  - no speculative interfaces and no duplicated logic;
  - no boolean flag parameters;
  - no magic numbers: tunables live in an `XxxConfig` with a default, a unit and a source;
  - readonly messages, and state only in classes with invariants;
  - names from the domain.
- **Tests:** they assert behaviour, not implementation. Seeds are explicit. Invariants get property-based tests (fast-check). Ports get contract tests.
- **Dependencies:** the matrix and the anti-cheat rule hold, and nothing is imported past a module's `index.ts`.
- **Scope:** nothing outside the task's files unless a ruling is recorded and explained.

Failure modes the spec implies that are most likely to bite a person using this code. Each one is pinned by a test in the task named:

1. **Angles on the seams:** exactly ±π, multiples of 2π, and −0. `normalizeAngle` returns a value in (−π, π], maps −π to π, and gives `0`, not `-0`, for −2π. Task 3.
2. **Non-finite angles:** `NaN` and `±Infinity` come back as `NaN`, never as a plausible angle. Task 3.
3. **Large accumulated headings** (|θ| up to 10⁶ rad after a long odometry run) still land in range and keep their direction. Task 3.
4. **Headings that straddle ±π:** `angleDiff` and `relative` take the short rotation (about 0.2 rad), not one of about 2π. Tasks 3 and 7.
5. **Imports that could slip past the architecture check:**
   - type-only imports, re-exports and dynamic `import()`;
   - relative paths from nested folders;
   - deep paths into another module;
   - app code that reaches an internal module;
   - core folders missing from the matrix.

   Task 4.

## Decisions taken while planning

The owner approves these with the plan:

- **`ng new` flags:** `--style=scss --ssr=false --ai-config=none --routing --zoneless --test-runner=vitest --skip-git --skip-install`.
- **ESLint boundaries** are `no-restricted-imports` regexes generated from the matrix, with no plugin. The architecture test resolves real paths, so the two guards fail independently.
- **The architecture test adds three rules the spec implies:**
  - `unknown-module`: a folder that is not in the matrix;
  - `public-api`: code outside the core reaches only `run` and `msgs`;
  - `core-packages`: production core code imports no package, and core spec files may import only `vitest` and `fast-check`.

  Cycles are checked both on the matrix and between files.
- **The fixtures live in memory** inside `architecture.spec.ts`, so no deliberately broken file sits in the repo.
- **Numbers the spec left open:**
  - `max-lines` is 300 per file;
  - spec files are exempt from `max-lines-per-function`, because a `describe` block is one long function.
- **"No boolean flags"** is enforced with `no-restricted-syntax` on parameters typed `boolean` or defaulted to `true` or `false`.
- **Immutability** is enforced with `@typescript-eslint/prefer-readonly` and `no-param-reassign`.
- **No `I` prefix** is enforced with `@typescript-eslint/naming-convention`.
- **OnPush is Angular 22's default,** so there is no explicit `changeDetection` and no lint rule for it.
- **`ng test` runs only `src/app/**/*.spec.ts`.** The core and architecture specs run in `npm run test:core`.
- **`noEmit` lives in the base `tsconfig.json`,** so `typecheck` can never write `.js` files next to the sources.
- **Prettier ignores `*.md`, `package-lock.json` and `.claude/`,** because tools rewrite those files.
- **Task 6 adds `vercel.json`** (config as code) and opens the phase PR as a **draft**, so CI and the Vercel preview run before the final review.

## File map

| Path | Responsibility | Tasks |
|---|---|---|
| `.nvmrc`, `.npmrc`, `.prettierignore`, `package.json` | Runtime, exact versions, formatting, scripts | 1, 2, 3 |
| `angular.json`, `src/main.ts`, `src/index.html`, `src/app/*` | The empty Angular shell | 1, 2, 3 |
| `tsconfig.json` | Shared strict options and the project references | 1, 2, 3 |
| `tsconfig.app.json`, `tsconfig.spec.json` | The app and its tests (with the DOM) | 1, 2, 3 |
| `tsconfig.core.json`, `tsconfig.core.spec.json` | The core and its tests: ES2022 only, no DOM, no Node | 2, 3 |
| `tsconfig.tools.json` | `vitest.core.config.ts` and `architecture/` | 3, 4 |
| `eslint.config.js` | Strict, clean-code, headless-core and boundary rules | 2, 4 |
| `vitest.core.config.ts` | Core and architecture tests in Node, with the coverage gate | 3, 4 |
| `src/core/math/{angle,pose2d,index}.ts` | Angle helpers, `Pose2D` and the module's public API | 3, 7 |
| `architecture/modules.mjs` | The dependency matrix, the single source of truth | 4 |
| `architecture/eslint-boundaries.mjs` | ESLint configs derived from the matrix | 4 |
| `architecture/source-files.ts` | Reads `.ts` files and their import specifiers | 4 |
| `architecture/import-rules.ts` | Checks imports against the rules (pure functions) | 4 |
| `architecture/architecture.spec.ts` | The codebase passes, and each rule fires on its fixture | 4 |
| `docs/architecture.md`, `docs/conventions.md`, `src/core/CLAUDE.md`, `src/app/CLAUDE.md`, `README.md` | Documentation | 5, 6 |
| `.github/workflows/ci.yml`, `vercel.json` | CI and deployment | 6 |
| `.claude/settings.json` | Ask before the guardrail configs are edited | 8 |

---

### Task 1: Toolchain

**Files:**
- Create: `.nvmrc`, `.npmrc`, `.prettierignore`
- Create, from `ng new`: `angular.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `.editorconfig`, `.prettierrc`, `.vscode/extensions.json`, `.vscode/launch.json`, `.vscode/tasks.json`, `public/favicon.ico`, `src/main.ts`, `src/index.html`, `src/styles.scss`, `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`, `src/app/app.config.ts`, `src/app/app.routes.ts`, `src/app/app.spec.ts`
- Delete: `src/app/.gitkeep`
- Unchanged: `README.md`, `CLAUDE.md`, `.gitignore`, `LICENSE`

**Interfaces:**
- Produces:
  - `npm start` (dev server on port 4200) and `npm run build`, which writes `dist/lidar-explorer/browser/`;
  - the root component `App` in `src/app/app.ts` (selector `app-root`, `protected readonly title = signal('lidar-explorer')`).

- [x] **Step 1: Confirm the runtime**

Run: `node --version && npm view @angular/cli@22.2.7 engines.node`
Expected: `v26.…` and `^22.22.3 || ^24.15.0 || >=26.0.0`. If Node is not 26, stop: the toolchain decision depends on it.

- [x] **Step 2: Generate the workspace in a temporary folder and merge it in**

```bash
TMP="$(mktemp -d)"
(cd "$TMP" && npx -y @angular/cli@22.2.7 new lidar-explorer --directory app \
  --style=scss --ssr=false --ai-config=none --routing --zoneless \
  --test-runner=vitest --skip-git --skip-install --package-manager=npm --interactive=false)
rm "$TMP/app/README.md" "$TMP/app/.gitignore"   # ours win
cp -r "$TMP/app/." .
rm -r "$TMP" src/app/.gitkeep
```

Corrected during execution: `ng new` resolves `--directory` against the current folder even when the path is absolute, so the command runs inside the temporary folder (see the Task 1 ruling in the ledger).

Expected: `git status --short README.md CLAUDE.md .gitignore` prints nothing, and `git status --short` lists only the new files and the deleted `src/app/.gitkeep`.

- [x] **Step 3: Pin the environment and install**

Create `.nvmrc` containing `26` and `.npmrc` containing `save-exact=true`, then:

```bash
npm pkg set engines.node=26.x
npm install
```

Expected: it installs and warns that 4 packages had install scripts blocked (esbuild, lmdb, @parcel/watcher and msgpackr-extract). That warning is expected.

Make every version exact. This is **the pin command**, reused in Task 2:

```bash
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));for(const k of ['dependencies','devDependencies'])for(const n of Object.keys(p[k]))p[k][n]=l.packages['node_modules/'+n].version;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
npm install
```

Expected: `grep -nE '"[~^]' package.json` prints nothing.

- [x] **Step 4: Write the failing app test**

In `src/app/app.spec.ts`, make `should render title` assert the exact heading:

```ts
expect(compiled.querySelector('h1')?.textContent).toBe('lidar-explorer');
```

Run: `npx ng test --watch=false`
Expected: FAIL, `expected 'Hello, lidar-explorer' to be 'lidar-explorer'`.

- [x] **Step 5: Replace the welcome page with the empty shell**

`src/app/app.html`:

```html
<main>
  <h1>{{ title() }}</h1>
  <p>A simulated robot will explore an unknown maze here, mapping it with a 2D lidar and noisy odometry.</p>
</main>
<router-outlet />
```

In `src/index.html`, set `<title>lidar-explorer</title>`.

Run: `npx ng test --watch=false`
Expected: `Tests  2 passed (2)`.

- [x] **Step 6: Set up Prettier**

`ng new` already added `.prettierrc` and `prettier`. Create `.prettierignore`:

```
*.md
package-lock.json
.claude/
```

Run: `npx prettier --write . && npx prettier --check .`
Expected: `All matched files use Prettier code style!`

- [x] **Step 7: Build and serve**

Run: `npm run build`
Expected: `Application bundle generation complete.`, and `dist/lidar-explorer/browser/index.html` exists.

Run `npm start` in the background and wait for `Local: http://localhost:4200/`. Then run `curl -s http://localhost:4200/ | grep -o '<app-root></app-root>'`.
Expected: `<app-root></app-root>`. Stop the server.

- [x] **Step 8: Commit**

```bash
git add -A && git status --short
git commit -m "chore(toolchain): scaffold the Angular 22 app on Node 26" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** `npm start` and open http://localhost:4200; `cat .nvmrc .npmrc`.

---

### Task 2: Strict typing and ESLint

**Files:**
- Modify: `tsconfig.json`, `tsconfig.app.json`, `src/main.ts`, `package.json` (`type`, and the ESLint packages added by `ng add`), `angular.json` (the `lint` target, added by `ng add`)
- Create: `tsconfig.core.json`, and `eslint.config.js` (generated by `ng add`, then replaced)

**Interfaces:**
- Consumes: Task 1's workspace.
- Produces:
  - `tsconfig.core.json` (ES2022 library, `types: []`, `src/core/**/*.ts` without specs), which Task 3 extends;
  - the flat config in `eslint.config.js`, which Task 4 extends with `...boundaryConfigs()`.

- [x] **Step 1: Strict compiler options and the core project**

In `tsconfig.json`, add `"strict": true`, `"noUncheckedIndexedAccess": true` and `"noEmit": true` to `compilerOptions`, and add `{ "path": "./tsconfig.core.json" }` to `references`.

In `tsconfig.app.json`, set `"include": ["src/main.ts", "src/app/**/*.ts"]` and keep `"exclude": ["src/**/*.spec.ts"]`.

Create `tsconfig.core.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "lib": ["ES2022"], "types": [] },
  "include": ["src/core/**/*.ts"],
  "exclude": ["src/core/**/*.spec.ts"]
}
```

`ES2022` is not arbitrary: the app also compiles the core (with ES2022 plus the DOM), so the core may not use newer APIs either.

- [x] **Step 2: Add angular-eslint and switch to ESM**

Run: `npx ng add angular-eslint@22.6.0 --skip-confirmation`
Expected: `CREATE eslint.config.js`, `UPDATE package.json`, `UPDATE angular.json` and `Packages installed successfully.`

Then run the pin command from Task 1 Step 3 (both of its lines), and `npm pkg set type=module`.

- [x] **Step 3: Replace `eslint.config.js`**

```js
// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

const HEADLESS = 'The core is headless (CLAUDE.md rule 3)';
const coreBannedGlobals = [
  ...['Date', 'performance'].map((name) => ({
    name,
    message: `${HEADLESS}: no wall clock, use the fixed dt.`,
  })),
  { name: 'console', message: `${HEADLESS}: no console, return data instead.` },
  ...[
    'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval',
    'clearImmediate', 'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  ].map((name) => ({ name, message: `${HEADLESS}: no timers, the loop runs on fixed ticks.` })),
  ...[
    'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'fetch',
    'XMLHttpRequest', 'self', 'globalThis', 'crypto', 'process', 'Buffer', 'require', 'module',
    '__dirname', '__filename',
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
        { selector: 'interface', format: ['PascalCase'], custom: { regex: '^I[A-Z]', match: false } },
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
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from math/ (CLAUDE.md rule 2).' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  { files: ['**/*.{js,mjs}'], extends: [eslint.configs.recommended] },
]);
```

- [x] **Step 4: Make the generated `src/main.ts` pass `strictTypeChecked`**

Change the catch handler to `.catch((error: unknown) => { console.error(error); });`. The arrow-shorthand void return and the untyped catch variable are the two errors the strict config reports.

- [x] **Step 5: Check that lint, build and tests are clean**

Run: `npx prettier --write . && npx eslint . --max-warnings=0`
Expected: exit 0, with no output.

Run: `npx ng build && npx ng test --watch=false`
Expected: the build completes, and `Tests  2 passed (2)`.

- [x] **Step 6: Plant violations; every guard must fire**

Create `src/core/math/planted.ts` with: a `Math.random()` call behind `// eslint-disable-next-line no-restricted-properties`; a `// @ts-ignore` line; a `document.title` read; `function flagged(verbose: boolean, a: number, b: number, c: number, d: number)`; a function with 10 `if` returns (complexity 11); and a function with 60 statement lines.

Run: `npx eslint src/core/math/planted.ts`
Expected, one line each:
- a warning that `'// eslint-disable-next-line no-restricted-properties' has no effect because you have 'noInlineConfig'`;
- `Use "@ts-expect-error" instead of "@ts-ignore"` (`@typescript-eslint/ban-ts-comment`, from `strictTypeChecked`);
- `'Math.random' is restricted from being used` (`no-restricted-properties`);
- `Unexpected use of 'document'` (`no-restricted-globals`);
- `has too many parameters (5)` (`@typescript-eslint/max-params`);
- `Boolean flag parameter` (`no-restricted-syntax`);
- `has a complexity of 11` (`complexity`);
- `has too many lines` (`max-lines-per-function`).

Run: `npx tsc -p tsconfig.core.json`
Expected: `error TS2584: Cannot find name 'document'`.

- [x] **Step 7: Remove the plant**

Run: `rm src/core/math/planted.ts && npx eslint . --max-warnings=0`
Expected: exit 0. Until Task 3 adds the first core file, `tsc -p tsconfig.core.json` reports `TS18003: No inputs were found`; that is expected.

- [x] **Step 8: Commit**

```bash
git add -A && git status --short
git commit -m "chore(lint): enforce strict typing and clean-code ESLint rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** plant `Math.random()` in `src/core/math/x.ts`, run `npx eslint src/core/math/x.ts`, then delete the file.

---

### Task 3: Core tests, scripts and angle helpers

**Files:**
- Create: `vitest.core.config.ts`, `tsconfig.core.spec.json`, `tsconfig.tools.json`, `src/core/math/angle.ts`, `src/core/math/angle.spec.ts`, `src/core/math/index.ts`
- Modify: `tsconfig.json` (references), `tsconfig.spec.json` (include), `angular.json` (test include), `package.json` (devDependencies and scripts), `CLAUDE.md` (the Commands section)
- Delete: `src/core/math/.gitkeep`

**Interfaces:**
- Consumes: `tsconfig.core.json` (Task 2).
- Produces:
  - `normalizeAngle(angle: number): number`: the same direction in (−π, π]; `0`, never `-0`, at multiples of 2π; `NaN` for non-finite input;
  - `angleDiff(a: number, b: number): number`: `normalizeAngle(a - b)`, the signed shortest rotation that takes `b` onto `a`;
  - both exported from `src/core/math/index.ts`;
  - the scripts `test`, `test:core`, `test:app`, `typecheck`, `lint`, `format`, `format:check`, `verify:fast` and `verify`;
  - `test.include` in `vitest.core.config.ts`, which Task 4 extends.

- [x] **Step 1: Install the test dependencies**

Run: `npm install -D "@vitest/coverage-v8@$(node -p "require('vitest/package.json').version")" fast-check@4.10.2`
Expected: `package.json` gains both packages at exact versions, and the coverage version equals the `vitest` version.

- [x] **Step 2: Configure the core test run and limit `ng test` to the app**

`vitest.core.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    environment: 'node',
    include: ['src/core/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.spec.ts', 'src/core/**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      reporter: ['text', 'html'],
    },
  },
});
```

`tsconfig.core.spec.json`:

```json
{
  "extends": "./tsconfig.core.json",
  "include": ["src/core/**/*.spec.ts"],
  "exclude": []
}
```

`exclude` must be `[]`, or the inherited exclude would drop the specs. The specs import `describe`, `it` and `expect` from `vitest` explicitly; there are no globals.

`tsconfig.tools.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "lib": ["ES2022"], "types": [] },
  "include": ["vitest.core.config.ts"]
}
```

Then:
- add `./tsconfig.core.spec.json` and `./tsconfig.tools.json` to the `references` in `tsconfig.json`;
- in `tsconfig.spec.json`, set `"include": ["src/**/*.d.ts", "src/app/**/*.spec.ts"]`;
- in `angular.json`, under `projects.lidar-explorer.architect.test`, add `"options": { "include": ["app/**/*.spec.ts"] }`. The path is relative to `src/`. Without it, `ng test` also runs the core specs.

- [x] **Step 3: Write the failing test**

`src/core/math/angle.spec.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { angleDiff, normalizeAngle } from './angle';

const PI = Math.PI;
const anyAngle = fc.double({ min: -1e6, max: 1e6, noNaN: true });
const nearAngle = fc.double({ min: -100, max: 100, noNaN: true });

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [PI, PI],
    [-PI, PI],
    [3 * PI, PI],
    [-3 * PI, PI],
    [(5 * PI) / 2, PI / 2],
    [(-3 * PI) / 2, PI / 2],
    [7, 7 - 2 * PI],
  ])('maps %f to %f', (angle, expected) => {
    expect(normalizeAngle(angle)).toBeCloseTo(expected, 12);
  });

  it('returns 0, not -0, for -2π', () => {
    expect(normalizeAngle(-2 * PI)).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns NaN for %f',
    (angle) => {
      expect(normalizeAngle(angle)).toBeNaN();
    },
  );

  it('always lands in (-π, π]', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        const result = normalizeAngle(angle);
        expect(result).toBeGreaterThan(-PI);
        expect(result).toBeLessThanOrEqual(PI);
      }),
    );
  });

  it('keeps the direction', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        const result = normalizeAngle(angle);
        expect(Math.cos(result)).toBeCloseTo(Math.cos(angle), 9);
        expect(Math.sin(result)).toBeCloseTo(Math.sin(angle), 9);
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        expect(normalizeAngle(normalizeAngle(angle))).toBe(normalizeAngle(angle));
      }),
    );
  });
});

describe('angleDiff', () => {
  it('is 0 between an angle and itself', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        expect(angleDiff(angle, angle)).toBe(0);
      }),
    );
  });

  it('takes the short way across the ±π seam', () => {
    expect(angleDiff(PI - 0.1, -PI + 0.1)).toBeCloseTo(-0.2, 12);
    expect(angleDiff(-PI + 0.1, PI - 0.1)).toBeCloseTo(0.2, 12);
  });

  it('is the rotation in (-π, π] that takes b onto a', () => {
    fc.assert(
      fc.property(nearAngle, nearAngle, (a, b) => {
        const diff = angleDiff(a, b);
        expect(diff).toBeGreaterThan(-PI);
        expect(diff).toBeLessThanOrEqual(PI);
        expect(angleDiff(b + diff, a)).toBeCloseTo(0, 9);
      }),
    );
  });
});
```

- [x] **Step 4: Run it and watch it fail**

Run: `npx vitest run --config vitest.core.config.ts`
Expected: FAIL, `Failed to resolve import "./angle"`.

- [x] **Step 5: Implement `normalizeAngle` and `angleDiff` in `src/core/math/angle.ts`, and export them from `src/core/math/index.ts`**

Approach: take `angle % (2π)`, then shift once by 2π if the result falls outside (−π, π], and add `0` at the end so that `-0` becomes `0`. Non-finite input propagates as `NaN` through `%`.

Give both functions TSDoc with the unit and the range. `index.ts` opens with a `@packageDocumentation` comment ("Math primitives for the core: angles and planar poses.") and re-exports both functions.

- [x] **Step 6: Run it and watch it pass**

Run: `npx vitest run --config vitest.core.config.ts --coverage`
Expected: `Tests  18 passed (18)`, and 100 % coverage for `angle.ts`.

- [x] **Step 7: Add the scripts and document them**

Set the scripts in `package.json`. Keep `ng`, `start`, `build` and `watch` as `ng new` wrote them.

```json
"test": "npm run test:core && npm run test:app",
"test:core": "vitest run --config vitest.core.config.ts --coverage",
"test:app": "ng test --watch=false",
"typecheck": "tsc -p tsconfig.app.json && tsc -p tsconfig.spec.json && tsc -p tsconfig.core.json && tsc -p tsconfig.core.spec.json && tsc -p tsconfig.tools.json",
"lint": "eslint . --max-warnings=0",
"format": "prettier --write .",
"format:check": "prettier --check .",
"verify:fast": "npm run typecheck && npm run lint && npm run test:core",
"verify": "npm run format:check && npm run verify:fast && npm run test:app && npm run build"
```

Replace the Commands section of `CLAUDE.md` with a table of these commands, one line each on what they do. Keep the note that `npm run bench` arrives in F7.

- [x] **Step 8: Plant uncovered code; the coverage gate must fire**

Create `src/core/math/planted.ts` exporting an untested three-line function, for example `untested(a: number, b: number): number`.

Run: `npm run test:core`
Expected: exit 1, with `ERROR: Coverage for lines (…%) does not meet global threshold (90%)`.

Run: `rm src/core/math/planted.ts && npm run test:core`
Expected: exit 0.

- [x] **Step 9: Run the full verification**

Run: `rm src/core/math/.gitkeep && npm run format && npm run verify`
Expected: exit 0. Every stage passes, and the output ends with `Application bundle generation complete.`

- [x] **Step 10: Commit**

```bash
git add -A && git status --short
git commit -m "feat(math): add angle helpers on a Vitest core setup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** `npm run test:core`, with the test list and the coverage table; `npm run verify`.

---

### Task 4: Architecture guardrails

**Files:**
- Create: `architecture/modules.mjs`, `architecture/eslint-boundaries.mjs`, `architecture/source-files.ts`, `architecture/import-rules.ts`, `architecture/architecture.spec.ts`
- Modify: `eslint.config.js`, `vitest.core.config.ts`, `tsconfig.tools.json`

**Interfaces:**
- Consumes: the flat config (Task 2), and `vitest.core.config.ts` and `tsconfig.tools.json` (Task 3).
- Produces:
  - `architecture/modules.mjs`:
    - `CORE_MODULES: Readonly<Record<string, readonly string[]>>`;
    - `AUTONOMY_MODULES`, `ANTI_CHEAT_FORBIDDEN`, `PUBLIC_MODULES` and `CORE_TEST_PACKAGES`, as frozen string arrays.
  - `architecture/eslint-boundaries.mjs`: `boundaryConfigs()`, which returns flat-config objects.
  - `architecture/source-files.ts`:
    - `interface SourceFile { readonly path: string; readonly imports: readonly string[] }`;
    - `importsOf(text: string): string[]`;
    - `readSourceFiles(root: string, folders: readonly string[]): SourceFile[]`.
  - `architecture/import-rules.ts`:
    - `type RuleName = 'anti-cheat' | 'matrix' | 'index-only' | 'public-api' | 'unknown-module' | 'core-packages' | 'cycle'`;
    - `interface Violation { readonly file: string; readonly rule: RuleName; readonly detail: string }`;
    - `checkImports(files: readonly SourceFile[]): Violation[]`;
    - `findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | undefined`.

- [x] **Step 1: Write the matrix, copied from `CLAUDE.md`**

`architecture/modules.mjs`:

```js
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
    'math', 'msgs', 'driver', 'world', 'sim', 'mapping', 'localization', 'slam', 'planning',
    'control', 'exploration', 'autonomy', 'eval',
  ],
});

/** The modules that make up the robot's autonomy. */
export const AUTONOMY_MODULES = Object.freeze([
  'mapping', 'localization', 'slam', 'planning', 'control', 'exploration', 'autonomy',
]);

/** The modules the anti-cheat rule hides from autonomy: they know the true pose or the true maze. */
export const ANTI_CHEAT_FORBIDDEN = Object.freeze(['sim', 'world', 'eval', 'run']);

/** The only core modules that code outside `src/core` may import. */
export const PUBLIC_MODULES = Object.freeze(['run', 'msgs']);

/** The packages core spec files may import. Production core code imports no package. */
export const CORE_TEST_PACKAGES = Object.freeze(['vitest', 'fast-check']);
```

- [x] **Step 2: Bring `architecture/` into the tools project and the core test run**

In `tsconfig.tools.json`, add `"allowJs": true, "checkJs": true` and set `"include": ["vitest.core.config.ts", "architecture/**/*.ts", "architecture/**/*.mjs"]`. With `checkJs`, the `.mjs` files are type-checked from their JSDoc.

In `vitest.core.config.ts`, set `include: ['src/core/**/*.spec.ts', 'architecture/**/*.spec.ts']`. Coverage stays on `src/core` only.

- [x] **Step 3: Write the failing test**

`architecture/architecture.spec.ts`:

```ts
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
```

- [x] **Step 4: Run it and watch it fail**

Run: `npx vitest run --config vitest.core.config.ts architecture`
Expected: FAIL, `Failed to resolve import "./import-rules"`.

- [x] **Step 5: Implement `source-files.ts` and `import-rules.ts`**

`source-files.ts`:
- `importsOf` returns `ts.preProcessFile(text, true, true).importedFiles` mapped to `fileName`. That covers type-only imports, re-exports and dynamic `import()`.
- `readSourceFiles` lists files with `ts.sys.readDirectory(`${root}/${folder}`, ['.ts'])` and reads them with `ts.sys.readFile`. Paths are POSIX and relative to `root`.

`import-rules.ts`, the rule semantics:
- **Resolution:** a relative specifier resolves against the importer's folder by walking its `.` and `..` segments. A path `src/core/<m>/<inner>` belongs to module `<m>`. Imports inside the same module are always allowed.
- **`unknown-module`:** the target module (or the importer's module) is not a key of `CORE_MODULES`.
- **`anti-cheat`:** the importer is in `AUTONOMY_MODULES` and the target is in `ANTI_CHEAT_FORBIDDEN`. It is reported instead of `matrix`.
- **`matrix`:** the target is not in `CORE_MODULES[importer]`.
- **`index-only`:** `<inner>` is not empty, `index`, `index.ts` or `index.js`.
- **`public-api`:** the importer is outside `src/core` and the target is not in `PUBLIC_MODULES`. `index-only` applies to these imports too.
- **`core-packages`:** a bare specifier imported from a core file, unless the file is a `*.spec.ts` and the package is in `CORE_TEST_PACKAGES`. Bare imports outside the core are free.
- **`cycle`:** build a file graph from the relative imports, resolving each to `x`, `x.ts` or `x/index.ts` among the scanned files, and run `findCycle` on it. Report one violation that names the path.
- **`findCycle`:** a depth-first search that returns the first cycle as a closed path, such as `['a', 'b', 'a']`, or `undefined` when there is none.

Keep every function within the lint limits. The prototype needed eight small functions.

- [x] **Step 6: Run it and watch it pass**

Run: `npx vitest run --config vitest.core.config.ts architecture`
Expected: `Tests  17 passed (17)`.

- [x] **Step 7: Derive the ESLint boundaries from the matrix**

`architecture/eslint-boundaries.mjs`:

```js
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
```

The outside regex is anchored on `./` or `../` on purpose: an unanchored `core/` also matches `@angular/core/testing`.

In `eslint.config.js`, import `{ boundaryConfigs }` from `'./architecture/eslint-boundaries.mjs'` and spread `...boundaryConfigs()` right after the `src/core/**` block. Only the boundary configs may set `no-restricted-imports`, because two configs setting it would override each other.

Run: `npx eslint . --max-warnings=0`
Expected: exit 0.

- [x] **Step 8: Plant `slam → sim`; both guards must fire**

Create `src/core/slam/planted.ts`: `import { step } from '../sim'; export const planted = step;`

Run: `npx eslint src/core/slam/planted.ts`
Expected: `'../sim' import is restricted from being used by a pattern. slam may import only: math, msgs, mapping, localization (architecture/modules.mjs)`.

Run: `npm run test:core`
Expected: FAIL in `the codebase > breaks no import rule`, with a violation whose `"rule"` is `"anti-cheat"`.

Run: `rm src/core/slam/planted.ts`. Keep `src/core/slam/.gitkeep`.

- [x] **Step 9: Run the full verification**

Run: `npm run format && npm run verify`
Expected: exit 0, with 35 core tests (18 + 17).

- [x] **Step 10: Commit**

```bash
git add -A && git status --short
git commit -m "feat(architecture): enforce the dependency matrix and the anti-cheat rule" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** run the Step 8 plant live, and `npx vitest run --config vitest.core.config.ts architecture` for the list of rules and their fixtures.

---

### Task 5: Documentation

TDD exception: documentation. The checks are `npm run verify` and the presence checks below.

**Files:**
- Create: `docs/architecture.md`, `docs/conventions.md`, `src/core/CLAUDE.md`, `src/app/CLAUDE.md`
- Modify: `README.md`, `CLAUDE.md` (the "Where things live" section)

**Interfaces:**
- Consumes: everything Tasks 1–4 built. The docs describe what exists, and link to the matrix rather than copy it as truth.
- Produces: `docs/conventions.md` with the review checklist that every later plan's Review Focus points to.

- [x] **Step 1: Write `docs/architecture.md`**

Sections, in this order:
1. **Purpose.** One paragraph, with a link to the F0 design.
2. **Data flow.** The mermaid diagram from the README.
3. **Modules.** A table with each module, its responsibility and what it may import. The table mirrors `architecture/modules.mjs`; say that the file is the source of truth and that the architecture test fails when the folders and the matrix diverge.
4. **The anti-cheat rule.** What it forbids, why (the Council's condition), and the two guards that enforce it.
5. **Seams.** The five interfaces from spec §2, where each one lives and which phase brings it, plus the rule that an abstraction waits for its second implementation.
6. **The tick loop.** The four steps, with a fixed `dt`.
7. **The Angular app.**
   - `app/core/` with `SimulationPort` and its adapters: main thread in F1–F7, worker in F8.
   - `app/features/explorer/`, with `render/`.
   - `app/features/results/` (F7).
   - Thin components.
8. **Guardrails.** A table with each guard, what it catches and where it lives:
   - `tsconfig.core.json`;
   - the core ESLint block;
   - the clean-code limits;
   - the boundaries;
   - the architecture test;
   - the coverage gate;
   - CI;
   - the permissions.
9. **Adding a module.** Create the folder and its `index.ts`, add the matrix entry, and write the tests. Name what fails when a step is skipped.

- [x] **Step 2: Write `docs/conventions.md`**

Sections:
1. **Units and frames.**
   - SI units, and a suffix for anything non-SI (`angleDeg`).
   - REP-103: x forward, y left, θ counter-clockwise from +x.
   - Angles through `normalizeAngle` and `angleDiff`. The circular mean is the `atan2` of the summed sines and cosines; its helper arrives with its first use.
   - The y-flip happens only in the renderer.
   - The grid is row-major, with cell (row, col) at `row * width + col`, as in ROS `nav_msgs/OccupancyGrid`.
2. **Errors.** `assert` for invariants (the helper arrives with its first use). A result union for expected failures, such as `{ ok: false, reason: 'unreachable' }`.
3. **Names.** Kebab-case files, PascalCase types with no `I` prefix, and domain words.
4. **Functions and files.** The ESLint limits (40 lines, 4 parameters, complexity 10, no boolean flags, 300 lines per file) and what to do instead.
5. **Tunables.** The `XxxConfig` pattern: an interface whose every field has a TSDoc line with its unit and source, plus a `DEFAULT_XXX_CONFIG` constant. Show the shape only, with no real numbers: rule 9 forbids guessing parameters.
6. **Immutability.** `readonly` messages; state lives only in classes with invariants; inputs are never mutated.
7. **Comments.** They explain the why, with a reference (book and section, or a datasheet).
8. **Tests.**
   - Behaviour, not implementation.
   - Explicit seeds.
   - fast-check for invariants.
   - Contract tests for ports.
   - Regression seeds.
   - Each bug is reproduced with a seed and a failing test first.
9. **Commits.** `type(scope): summary`, with the module as scope, and the co-author trailer.
10. **Review checklist.** The `CLAUDE.md` Review Focus block, verbatim.

- [x] **Step 3: Write the agent guides**

`src/core/CLAUDE.md` (about 25 lines):
- Read `docs/architecture.md` and `docs/conventions.md` first.
- Hard rules 1–4 as they apply here, and the fact that the guards enforce them: no DOM, no Node, no timers, no clock, no `console`, no `Math.random`, no packages.
- Inline lint disables do not work here (`noInlineConfig`): fix the code.
- Another module is imported only through its `index.ts`, and only as `architecture/modules.mjs` allows.
- Each `index.ts` is the public API, with TSDoc on every export.
- Tunables go in `XxxConfig`.
- Tests are co-located `*.spec.ts` files that import from `vitest` explicitly and use fast-check for invariants. Run them with `npm run test:core`; the coverage gate is 90 %.

`src/app/CLAUDE.md` (about 25 lines). This adapts the owner's LigaVerano conventions, with this project's rules winning, for example no `I` prefix:
- Angular 22 standalone and zoneless.
- OnPush is the default: never set `ChangeDetectionStrategy.Eager`.
- Signals for state; no `Subject` or `BehaviorSubject` for local state.
- `input()`, `output()` and `inject()`; no constructor injection.
- `@if`, `@for` and `@switch`; no NgModule.
- File names in the 2025 style (`explorer-page.ts`), and the `app-` selector prefix.
- The folders from the architecture doc.
- Components are thin and carry no robotics logic.
- The app reaches the core only through `SimulationPort`, `run` and the `msgs` types; the architecture test enforces it.
- Canvas drawing lives in pure `drawX(ctx, snapshot, viewport)` functions, and the y-flip lives there.
- No `any`, no `as unknown`, and no library without approval.
- Tests run with `npm run test:app`.

- [x] **Step 4: Update `README.md` and `CLAUDE.md`**

README:
- Status: "F0 · foundations: the app shell, the guardrails and CI are in place; the robot arrives in F1."
- A new **How it's built** section:
  - the method (Superpowers: design → plan → TDD tasks → review → PR, with the owner's gates);
  - the architecture (a hexagonal core, one matrix, and the anti-cheat rule enforced by ESLint and by the architecture test);
  - the guardrails (strict TypeScript, a DOM-free core, the lint limits, the 90 % coverage gate and CI);
  - links to both docs.
- **Development:** Node 26 (`.nvmrc`), `npm install`, and the main commands.
- **Repository layout:** add `architecture/` and `docs/`, and the new core modules `control`, `autonomy` and `run`.

`CLAUDE.md` "Where things live": the architecture and conventions entry now points at the two docs and drops "Until they exist…".

- [x] **Step 5: Verify**

Run: `npm run verify && ls docs/architecture.md docs/conventions.md src/core/CLAUDE.md src/app/CLAUDE.md && grep -c "How it's built" README.md`
Expected: exit 0, the four paths are listed, and the count is `1`.

- [x] **Step 6: Commit**

```bash
git add -A && git status --short
git commit -m "docs: add the architecture, conventions and agent guides" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** `docs/architecture.md` (the guardrails table) and the new README section.

---

### Task 6: CI, Vercel and the protection of `main`

TDD exception: configuration. The proof is a green CI run on the PR and a loading Vercel preview.

**Files:**
- Create: `.github/workflows/ci.yml`, `vercel.json`
- Delete: `.github/workflows/.gitkeep`
- Modify: `README.md` (the CI badge)

**Interfaces:**
- Consumes: `npm run verify` (Task 3) and `.nvmrc` (Task 1).
- Produces: the status check named `verify`, which the ruleset on `main` requires.

**Owner prerequisites:**
- The public repo `Joaquinrs05/lidar-explorer` exists, and `origin` points to it. Both are done.
- `gh` with `gh auth login` is optional. Without it, the owner does Steps 5 and 7 in the GitHub web UI; each step gives both routes. Claude follows CI through the public REST API, which needs no login.

- [x] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: verify
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run verify
```

Delete `.github/workflows/.gitkeep`.

- [x] **Step 2: Write `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "angular",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/lidar-explorer/browser"
}
```

Vercel takes Node `26.x` from `engines`.

- [x] **Step 3: Add the badge under the README title**

```md
[![CI](https://github.com/Joaquinrs05/lidar-explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/Joaquinrs05/lidar-explorer/actions/workflows/ci.yml)
```

- [x] **Step 4: Verify locally and commit**

Run: `npm run format && npm run verify`
Expected: exit 0. Prettier also parses the YAML and the JSON.

```bash
git add -A && git status --short
git commit -m "ci: verify every pull request and configure Vercel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [x] **Step 5: Push and open the phase PR as a draft**

```bash
git push
gh pr create --draft --base main --title "F0 · Foundations" --body "$(cat <<'EOF'
Phase F0: toolchain, strict typing, clean-code lint, core tests behind a coverage gate, architecture guardrails (dependency matrix and anti-cheat rule), docs, CI, and the first domain code (angles and Pose2D).

- Design: docs/superpowers/specs/2026-11-13-f0-foundations-design.md
- Plan: docs/superpowers/plans/2026-11-13-f0-foundations.md

Draft until the final review.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: the PR URL.

Run: `gh pr checks --watch`
Expected: `verify` passes.

**Without `gh`:**
1. After `git push`, the owner opens https://github.com/Joaquinrs05/lidar-explorer/compare/main...fase-0-cimientos, chooses **Create draft pull request**, and uses the same title and body.
2. Claude polls `curl -s "https://api.github.com/repos/Joaquinrs05/lidar-explorer/actions/runs?branch=fase-0-cimientos&per_page=1"` until `status` is `completed`.

Expected: `conclusion` is `success`. The jobs endpoint of that run names the failing step, if any.

- [ ] **Step 6: Owner: connect Vercel**

1. In Vercel: Add New → Project → import the repo, keep the settings that `vercel.json` provides, and Deploy.
2. The first production deployment builds `main`, which has no app yet, so it fails. That is expected until F0 merges.
3. The PR gets a preview link from the Vercel bot.

Expected: the preview shows the "lidar-explorer" heading.

- [ ] **Step 7: Protect `main` with a ruleset (skip it if "Protect main" already exists)**

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api "repos/$REPO/rulesets" --jq '.[].name'
gh api "repos/$REPO/rulesets" --method POST --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false, "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false, "required_status_checks": [{ "context": "verify" }] } }
  ]
}
EOF
gh api "repos/$REPO/rules/branches/main" --jq '.[].type'
```

Expected: the last command lists `deletion`, `non_fast_forward`, `pull_request` and `required_status_checks`.

**Without `gh`,** the owner goes to Settings → Rules → Rulesets → New ruleset → New branch ruleset:
1. Name it `Protect main`, set enforcement to **Active**, and set the target to **Include default branch**.
2. Tick these rules:
   - **Restrict deletions**;
   - **Require a pull request before merging**, with 0 approvals;
   - **Require status checks to pass**, adding `verify` (it is offered after the first CI run);
   - **Block force pushes**.
3. Save.

Expected: `curl -s https://api.github.com/repos/Joaquinrs05/lidar-explorer/rules/branches/main` lists those four rule types.

**Show the owner:** the PR's checks tab, the Vercel preview and the badge.

---

### Task 7: `Pose2D`

**Files:**
- Create: `src/core/math/pose2d.ts`, `src/core/math/pose2d.spec.ts`
- Modify: `src/core/math/index.ts`

**Interfaces:**
- Consumes: `normalizeAngle` and `angleDiff` (Task 3).
- Produces, exported from `src/core/math/index.ts`; F1's odometry consumes them:
  - `interface Pose2D { readonly x: number; readonly y: number; readonly theta: number }`: metres and radians in a REP-103 frame, with the same fields as ROS `geometry_msgs/Pose2D`;
  - `compose(a: Pose2D, b: Pose2D): Pose2D`: a ⊕ b, the pose `b` (given in the frame of `a`) expressed in the frame that `a` is given in;
  - `inverse(pose: Pose2D): Pose2D`: ⊖p, the parent frame's origin expressed in the frame of `p`;
  - `relative(from: Pose2D, to: Pose2D): Pose2D`: ⊖from ⊕ to, the pose `to` expressed in the frame of `from`.

- [ ] **Step 1: Write the failing test**

`src/core/math/pose2d.spec.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { angleDiff } from './angle';
import { compose, inverse, relative, type Pose2D } from './pose2d';

const IDENTITY: Pose2D = { x: 0, y: 0, theta: 0 };
const coordinate = fc.double({ min: -100, max: 100, noNaN: true });
const heading = fc.double({ min: -10, max: 10, noNaN: true });
const pose = fc.record({ x: coordinate, y: coordinate, theta: heading });

function expectSamePose(actual: Pose2D, expected: Pose2D): void {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
  expect(angleDiff(actual.theta, expected.theta)).toBeCloseTo(0, 9);
}

function expectNormalized(theta: number): void {
  expect(theta).toBeGreaterThan(-Math.PI);
  expect(theta).toBeLessThanOrEqual(Math.PI);
}

describe('compose', () => {
  it('moves along the heading: x forward, y left, θ counter-clockwise (REP-103)', () => {
    const facingLeft: Pose2D = { x: 1, y: 0, theta: Math.PI / 2 };
    const oneMetreAhead: Pose2D = { x: 1, y: 0, theta: 0 };
    expectSamePose(compose(facingLeft, oneMetreAhead), { x: 1, y: 1, theta: Math.PI / 2 });
  });

  it('has the origin as identity on both sides', () => {
    fc.assert(
      fc.property(pose, (p) => {
        expectSamePose(compose(p, IDENTITY), p);
        expectSamePose(compose(IDENTITY, p), p);
      }),
    );
  });

  it('is associative', () => {
    fc.assert(
      fc.property(pose, pose, pose, (a, b, c) => {
        expectSamePose(compose(compose(a, b), c), compose(a, compose(b, c)));
      }),
    );
  });

  it('returns headings in (-π, π]', () => {
    fc.assert(
      fc.property(pose, pose, (a, b) => {
        expectNormalized(compose(a, b).theta);
        expectNormalized(inverse(a).theta);
        expectNormalized(relative(a, b).theta);
      }),
    );
  });
});

describe('inverse', () => {
  it('expresses the origin in the frame of the pose', () => {
    expectSamePose(inverse({ x: 2, y: 0, theta: Math.PI / 2 }), {
      x: 0,
      y: 2,
      theta: -Math.PI / 2,
    });
  });

  it('composes with the pose to the identity on both sides', () => {
    fc.assert(
      fc.property(pose, (p) => {
        expectSamePose(compose(p, inverse(p)), IDENTITY);
        expectSamePose(compose(inverse(p), p), IDENTITY);
      }),
    );
  });
});

describe('relative', () => {
  it('expresses `to` in the frame of `from`', () => {
    fc.assert(
      fc.property(pose, pose, (from, to) => {
        expectSamePose(compose(from, relative(from, to)), to);
      }),
    );
  });

  it('takes the short rotation across the ±π seam', () => {
    const before: Pose2D = { x: 0, y: 0, theta: Math.PI - 0.1 };
    const after: Pose2D = { x: 0, y: 0, theta: -Math.PI + 0.1 };
    expect(relative(before, after).theta).toBeCloseTo(0.2, 12);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --config vitest.core.config.ts pose2d`
Expected: FAIL, `Failed to resolve import "./pose2d"`.

- [ ] **Step 3: Implement `pose2d.ts` and export it from `index.ts`**

The formulas pin the frame conventions. Write c and s for the cosine and sine of the heading in each formula.
- `compose`:
  - x = a.x + c·b.x − s·b.y;
  - y = a.y + s·b.x + c·b.y;
  - θ = `normalizeAngle(a.θ + b.θ)`.
- `inverse`:
  - x = −c·x − s·y;
  - y = s·x − c·y;
  - θ = `normalizeAngle(−θ)`.
- `relative` (dx = to.x − from.x, dy = to.y − from.y, with the heading of `from`):
  - x = c·dx + s·dy;
  - y = −s·dx + c·dy;
  - θ = `angleDiff(to.θ, from.θ)`.

Give each export TSDoc with the ⊕/⊖ meaning above. Export them from `index.ts` with `export { compose, inverse, relative } from './pose2d';` and `export type { Pose2D } from './pose2d';`.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --config vitest.core.config.ts pose2d`
Expected: `Tests  8 passed (8)`.

- [ ] **Step 5: Run the full verification and commit**

Run: `npm run format && npm run verify`
Expected: exit 0, with 43 core tests and 100 % coverage on `src/core/math`.

```bash
git add -A && git status --short
git commit -m "feat(math): add Pose2D composition, inverse and relative pose" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**Show the owner:** `npx vitest run --config vitest.core.config.ts pose2d`, and explain the `compose` example in REP-103 terms.

---

### Task 8: Close the guardrails

TDD exception: configuration. The proof is the owner's manual check in Step 3.

**Files:**
- Modify: `.claude/settings.json`

**Interfaces:**
- Consumes: the guardrail files from Tasks 1–6.
- Produces: permission prompts before any of those files is edited.

- [ ] **Step 1: Add the ask rules**

Append these entries to `permissions.ask` in `.claude/settings.json`:

```json
"Edit(./eslint.config.js)",
"Edit(./tsconfig*.json)",
"Edit(./vitest*.config.ts)",
"Edit(./architecture/**)",
"Edit(./.github/**)",
"Edit(./.claude/**)",
"Edit(./package.json)"
```

`Edit` rules cover every built-in file-editing tool. They do not stop a shell command from writing those files; the reviewer and CI cover that gap.

- [ ] **Step 2: Check that the file is valid and commit**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" && npm run verify`
Expected: exit 0.

```bash
git add .claude/settings.json
git commit -m "chore(harness): ask before the guardrail configs are edited" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Owner's manual check, in a new Claude Code session in the repo**

1. Ask Claude to add a blank line at the end of `eslint.config.js`. Expected: a permission prompt; reject it.
2. Ask for `git push --force`. Expected: denied.
3. Ask Claude to read `.env`. Expected: denied.

**Show the owner:** Step 3 itself.

---

## After Task 8

1. Run the final whole-branch review: `executing-plans` dispatches it, with this plan's Review Focus.
2. Fix the Critical and Important findings in one TDD pass, then run `finishing-a-development-branch`. The draft PR from Task 6 becomes ready for review and merges once `verify` is green.
3. Run the phase close in `CLAUDE.md`:
   - update the vault note: progress, hours, decisions and status ("F1, to be designed with `brainstorming`");
   - write the concept note with the owner.
