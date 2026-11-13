# src/core — instructions for agents

The robot's brain and its simulated world, in pure TypeScript. Read [docs/architecture.md](../../docs/architecture.md) and [docs/conventions.md](../../docs/conventions.md) before you change anything here.

## Rules that apply here

- **Headless.** No DOM, no Node APIs, no timers, no wall clock and no `console`. `tsconfig.core.json` has no DOM or Node types, and ESLint bans the rest.
- **Seeded.** No `Math.random()`: use the seeded `Rng` from `math/` and `fork()` one stream per subsystem.
- **SI units and REP-103 frames.** Non-SI names carry a unit suffix. Angles go through `normalizeAngle` and `angleDiff`.
- **No packages.** Production core code imports only relative paths; spec files may also import `vitest` and `fast-check`.
- **Inline lint disables do nothing here** (`noInlineConfig`). If a rule blocks you, fix the code. Never weaken the config (rule 8 in the root `CLAUDE.md`).

## Modules

- Each folder is a module, and its `index.ts` is its public API, with TSDoc on every export.
- Import another module only through its `index.ts`, and only if `architecture/modules.mjs` allows it. The autonomy modules never import `sim`, `world`, `eval` or `run`.
- Tunables live in an `XxxConfig` with a default, a unit and a source.

## Tests

- Specs sit next to the code as `*.spec.ts` and run in Node; import `describe`, `it` and `expect` from `vitest` explicitly.
- Use fast-check for invariants, and keep every seed explicit.
- `npm run test:core` runs them behind the 90 % coverage gate; `npm run verify:fast` adds the type check and lint.
