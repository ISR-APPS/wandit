/**
 * Parses the `git show` patch text of one version into per-file line lists
 * that DiffCard renders. Pure function: no fetch, no React.
 * Called by the Diff toggle of components/shell/versions-popover.tsx.
 */

import type { BuilderDiffLine } from "../api/dto";

/**
 * The `diff --git a/<path> b/<path>` header of one file. The path is the
 * `b/` side: the name the file has after the commit.
 */
// LIMIT: an `a/` path that holds " b/" reads a wrong path. Upgrade: read the path from the `+++ b/` line.
const FILE_HEADER = /^diff --git a\/.*? b\/(.+)$/;

/**
 * Splits a `git show` patch into one `{ path, lines }` entry per file for
 * DiffCard. The path is the `b/` side of the header. A file whose path git
 * quoted is skipped.
 */
export function parseUnifiedDiff(
	patch: string,
): { path: string; lines: BuilderDiffLine[] }[] {
	const files: { path: string; lines: BuilderDiffLine[] }[] = [];
	// The split leaves a phantom empty element when the patch ends with a newline.
	const rows = patch.split("\n");
	if (rows.at(-1) === "") rows.pop();

	let current: { path: string; lines: BuilderDiffLine[] } | null = null;
	// True once the file's first `@@` hunk header appeared. Before it, `---`
	// and `+++` are file headers; inside a hunk they are removed and added
	// lines that hold `--` or `++` text.
	let inHunk = false;

	for (const row of rows) {
		const header = FILE_HEADER.exec(row);
		if (header) {
			current = { path: header[1], lines: [] };
			files.push(current);
			inHunk = false;
			continue;
		}
		if (row.startsWith("diff --git ")) {
			// LIMIT: quoted paths are skipped. Upgrade: unquote the C-style path.
			current = null;
			continue;
		}
		// Text before the first `diff --git` is the commit header of `git show`.
		if (current === null) continue;
		if (row.startsWith("@@")) {
			inHunk = true;
			current.lines.push({ kind: "context", text: row });
			continue;
		}
		// Every line before the first hunk is a file header: `index`, `---`,
		// `+++`, modes, `similarity`, `rename`, `Binary files`.
		if (!inHunk) continue;
		if (row.startsWith("+")) {
			current.lines.push({ kind: "add", text: row.slice(1) });
		} else if (row.startsWith("-")) {
			current.lines.push({ kind: "remove", text: row.slice(1) });
		} else if (row.startsWith(" ") || row === "") {
			current.lines.push({ kind: "context", text: row.slice(1) });
		}
		// The rest, like `\ No newline at end of file`, is skipped.
	}

	return files;
}
