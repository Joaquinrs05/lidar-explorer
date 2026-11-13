# src/app — instructions for agents

The Angular 22 UI. It renders snapshots of the simulation and forwards user input; it holds no robotics logic. Read [docs/architecture.md](../../docs/architecture.md) and [docs/conventions.md](../../docs/conventions.md) first.

## Angular

- Standalone components and zoneless change detection; no `NgModule`.
- OnPush is Angular 22's default: never set `ChangeDetectionStrategy.Eager`.
- Signals hold state (`signal`, `computed`, `effect`); no `Subject` or `BehaviorSubject` for local state.
- `input()` and `output()` for component APIs, and `inject()` for dependencies; no constructor injection.
- Built-in control flow: `@if`, `@for` and `@switch`.
- File names follow the 2025 style (`explorer-page.ts`, `.html`, `.scss`), and selectors start with `app-`.

## Structure

- `core/`: `SimulationPort` and its adapters (the main thread now, a Web Worker in F8).
- `features/explorer/`: the page, the controls, the metrics and `render/`.
- `features/results/`: the benchmark panel (F7).

## Rules

- Components are thin. Robotics logic belongs in `src/core/`.
- The app reaches the core only through `SimulationPort`, `run` and the `msgs` types; the architecture test enforces it.
- Canvas drawing lives in pure `drawX(ctx, snapshot, viewport)` functions in `render/`, and the canvas y-flip happens only there.
- No `any`, no `as unknown`, and no new library without the owner's approval.
- Tests run with `npm run test:app` (Vitest with jsdom).
