import ts from 'typescript';

/** A TypeScript file, by its root-relative POSIX path, and the specifiers it imports. */
export interface SourceFile {
  readonly path: string;
  readonly imports: readonly string[];
}

/** Every specifier `text` imports or re-exports, including type-only and dynamic imports. */
export function importsOf(text: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName);
}

/** Reads every `.ts` file under the given folders of `root`, with paths relative to `root`. */
export function readSourceFiles(root: string, folders: readonly string[]): SourceFile[] {
  return folders.flatMap((folder) =>
    ts.sys.readDirectory(`${root}/${folder}`, ['.ts']).map((absolute) => ({
      path: absolute.slice(root.length + 1),
      imports: importsOf(ts.sys.readFile(absolute) ?? ''),
    })),
  );
}
