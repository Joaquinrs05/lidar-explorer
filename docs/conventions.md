# Conventions

These conventions apply to all the code in the repo, and the core (`src/core/`) follows them strictly. Many of them are enforced mechanically (see [the guardrails](architecture.md#guardrails)); the rest are checked in review with the checklist at the end of this page.

## Units and frames

- **SI units** everywhere in the core: metres, radians, seconds, m/s and rad/s. Anything non-SI carries a unit suffix, such as `angleDeg`, `periodMs` or `sizeCells`.
- **Frames follow [ROS REP-103](https://www.ros.org/reps/rep-0103.html):** x forward, y left and z up, with angles counter-clockwise from +x.
- **Angles** are always wrapped to (−π, π] with `normalizeAngle`, and differences go through `angleDiff`, which takes the short way across ±π. Angles are averaged circularly: the mean is `atan2(Σ sin θ, Σ cos θ)`. Its helper arrives with its first use.
- **The screen:** the canvas y-axis points down. The flip happens only in the renderer, never in the core.
- **Grids** are row-major: cell (row, col) sits at index `row * width + col`, as in ROS `nav_msgs/OccupancyGrid`.

## Errors

- A broken invariant is a programming error, and it throws through an `assert` helper. The helper arrives with its first use.
- An expected failure is a value, not an exception: a result union such as `{ ok: true, value } | { ok: false, reason: 'unreachable' }`.

## Names

- Files are kebab-case: `occupancy-grid.ts` and `occupancy-grid.spec.ts`.
- Types are PascalCase, and interfaces carry no `I` prefix (ESLint enforces it).
- Names come from the domain, such as `pose`, `scan`, `particle`, `frontier` and `goal`, not `data`, `item` or `manager`.

## Functions and files

ESLint enforces these limits:

| Limit | Maximum | Instead |
|---|---|---|
| Lines per function | 40, without blank lines or comments; spec files are exempt | Extract named steps |
| Parameters | 4 | Pass an options object |
| Cyclomatic complexity | 10 | Split the decision, or use a lookup table |
| Boolean flag parameters | none | Write two functions, or pass an options object |
| Lines per file | 300 | Split the file by responsibility |

## Tunables

There are no magic numbers. Every tunable lives in a config interface, and each field states its unit and its source:

```ts
/** Tunables of the frontier detector. */
export interface FrontierConfig {
  /** Smallest frontier worth visiting, in cells. Source: the benchmark run that tuned it. */
  readonly minSizeCells: number;
}
```

Next to the interface, a `DEFAULT_FRONTIER_CONFIG` constant holds the defaults, and each value keeps the source that its field names. Lidar values come only from the RPLIDAR C1 datasheet; never guess them.

## Immutability and state

- Messages in `msgs/` are `readonly` all the way down.
- Mutable state lives only in classes that guard an invariant, such as a grid that keeps its log-odds within bounds. Everything else is plain functions over readonly data.
- Functions never mutate their inputs. ESLint forbids reassigning parameters, and `prefer-readonly` marks fields that never change.

## Comments

Comments explain why, not what, and cite their source: a book and section ("Probabilistic Robotics, §5.4"), a paper, a REP or a datasheet page. Every export of a module's `index.ts` has TSDoc.

## Tests

- Tests come first, and each one is seen failing before the code exists (TDD).
- They assert behaviour, not implementation: inputs and observable outputs, without peeking at private state.
- Randomness is seeded, and the seed is explicit in the test.
- Invariants get property-based tests with fast-check.
- Ports get contract tests that every implementation must pass.
- Regression tests pin fixed seeds.
- A bug is first reproduced with a seed and a failing test, and only then fixed.
- Core specs sit next to the code as `*.spec.ts` and import `describe`, `it` and `expect` from `vitest` explicitly.

## Commits

Each task ends in one conventional commit, `type(scope): summary`, where the scope is the module: `feat(math): …` or `fix(slam): …`. Commits end with the `Co-Authored-By` trailer, which declares Claude's co-authorship.

## Review checklist

Copied from `CLAUDE.md`; every plan repeats it in its Review Focus.

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
