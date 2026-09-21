/**
 * Parser for `git show --numstat` output.
 * `commitTurn` feeds it the raw stdout of one commit's numstat; the result
 * lands in the `app_commits.numstat` column and in the R2 `.numstat` object.
 */

/** Added and removed line counts of one file in one commit. */
export type GitNumstatEntry = {
	/** File path as git prints it; a rename keeps the `old => new` form. */
	path: string;
	/** Added lines. 0 on a binary file because git prints `-`. */
	insertions: number;
	/** Removed lines. 0 on a binary file because git prints `-`. */
	deletions: number;
};

/**
 * Parses the lines of `git show --numstat --format= HEAD`. Each line is
 * `insertions<TAB>deletions<TAB>path`; a `-` count means a binary file and
 * stores 0. Lines that do not match are skipped.
 */
export function parseNumstat(output: string): GitNumstatEntry[] {
	const entries: GitNumstatEntry[] = [];
	for (const line of output.split("\n")) {
		if (line.trim() === "") {
			continue;
		}
		const [insertionsField, deletionsField, ...pathParts] = line.split("\t");
		if (insertionsField === undefined || deletionsField === undefined) {
			continue;
		}
		// A path may contain a tab; the remaining fields join back into it.
		const path = pathParts.join("\t");
		if (path === "") {
			continue;
		}
		entries.push({
			path,
			insertions: parseNumstatCount(insertionsField),
			deletions: parseNumstatCount(deletionsField),
		});
	}
	return entries;
}

// git prints `-` for binary files; the column stores numbers only.
function parseNumstatCount(field: string): number {
	if (field === "-") {
		return 0;
	}
	const count = Number.parseInt(field, 10);
	return Number.isNaN(count) ? 0 : count;
}
