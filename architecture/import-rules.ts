import {
  ANTI_CHEAT_FORBIDDEN,
  AUTONOMY_MODULES,
  CORE_MODULES,
  CORE_TEST_PACKAGES,
  PUBLIC_MODULES,
} from './modules.mjs';
import type { SourceFile } from './source-files';

/** The architecture rule an import breaks. */
export type RuleName =
  | 'anti-cheat'
  | 'matrix'
  | 'index-only'
  | 'public-api'
  | 'unknown-module'
  | 'core-packages'
  | 'cycle';

/** One broken rule: the file that breaks it and what it reached for. */
export interface Violation {
  readonly file: string;
  readonly rule: RuleName;
  readonly detail: string;
}

/** Where a path lands inside `src/core`: the module, and the path inside that module. */
interface CoreLocation {
  readonly module: string;
  readonly inner: string;
}

const CORE_PREFIX = 'src/core/';
const INDEX_FILE = /^index(\.[jt]s)?$/;

function violation(file: string, rule: RuleName, detail: string): Violation {
  return { file, rule, detail };
}

function isCoreModule(name: string): boolean {
  return Object.hasOwn(CORE_MODULES, name);
}

/** Resolves a relative specifier against the folder of `importer`. */
function resolve(importer: string, specifier: string): string {
  const parts = importer.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function locate(path: string): CoreLocation | undefined {
  if (!path.startsWith(CORE_PREFIX)) return undefined;
  const [module = '', ...inner] = path.slice(CORE_PREFIX.length).split('/');
  return { module, inner: inner.join('/') };
}

function checkPackage(importer: string, specifier: string): Violation[] {
  if (locate(importer) === undefined) return [];
  const isTestPackage = importer.endsWith('.spec.ts') && CORE_TEST_PACKAGES.includes(specifier);
  return isTestPackage ? [] : [violation(importer, 'core-packages', specifier)];
}

function checkIndex(importer: string, target: CoreLocation): Violation[] {
  const throughIndex = target.inner === '' || INDEX_FILE.test(target.inner);
  return throughIndex
    ? []
    : [violation(importer, 'index-only', `${target.module}/${target.inner}`)];
}

function checkEdge(importer: string, from: string, to: string): Violation[] {
  if (AUTONOMY_MODULES.includes(from) && ANTI_CHEAT_FORBIDDEN.includes(to)) {
    return [violation(importer, 'anti-cheat', `${from} → ${to}`)];
  }
  if (!isCoreModule(from)) return [violation(importer, 'unknown-module', from)];
  const allowed = CORE_MODULES[from] ?? [];
  return allowed.includes(to) ? [] : [violation(importer, 'matrix', `${from} → ${to}`)];
}

function checkImport(importer: string, specifier: string): Violation[] {
  if (!specifier.startsWith('.')) return checkPackage(importer, specifier);
  const target = locate(resolve(importer, specifier));
  const from = locate(importer)?.module;
  if (target === undefined || target.module === from) return [];
  if (!isCoreModule(target.module)) return [violation(importer, 'unknown-module', target.module)];
  if (from === undefined && !PUBLIC_MODULES.includes(target.module)) {
    return [violation(importer, 'public-api', target.module)];
  }
  const edge = from === undefined ? [] : checkEdge(importer, from, target.module);
  return [...edge, ...checkIndex(importer, target)];
}

/** The first cycle in `graph` as a closed path of nodes, or `undefined` when it has none. */
export function findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const finished = new Set<string>();
  const visit = (node: string, path: readonly string[]): string[] | undefined => {
    const start = path.indexOf(node);
    if (start !== -1) return [...path.slice(start), node];
    if (finished.has(node)) return undefined;
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next, [...path, node]);
      if (cycle !== undefined) return cycle;
    }
    finished.add(node);
    return undefined;
  };
  for (const node of graph.keys()) {
    const cycle = visit(node, []);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

/** File-to-file edges of the relative imports, each resolved to `x`, `x.ts` or `x/index.ts`. */
function fileGraph(files: readonly SourceFile[]): Map<string, string[]> {
  const known = new Set(files.map((file) => file.path));
  const resolveFile = (path: string): string[] =>
    [path, `${path}.ts`, `${path}/index.ts`]
      .filter((candidate) => known.has(candidate))
      .slice(0, 1);
  return new Map(
    files.map((file) => [
      file.path,
      file.imports
        .filter((specifier) => specifier.startsWith('.'))
        .flatMap((specifier) => resolveFile(resolve(file.path, specifier))),
    ]),
  );
}

/** Checks every import in `files` against the dependency matrix and the core's import rules. */
export function checkImports(files: readonly SourceFile[]): Violation[] {
  const broken = files.flatMap((file) =>
    file.imports.flatMap((specifier) => checkImport(file.path, specifier)),
  );
  const cycle = findCycle(fileGraph(files));
  if (cycle === undefined) return broken;
  return [...broken, violation(cycle[0] ?? '', 'cycle', cycle.join(' → '))];
}
