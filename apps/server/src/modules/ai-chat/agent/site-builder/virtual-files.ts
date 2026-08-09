/**
 * In-memory file system the site-builder agent writes into.
 *
 * The builder never touches disk or R2 directly: it writes here through its
 * tools, and the Trigger.dev task uploads the final snapshot once the build
 * is validated. That keeps the agent pure (no credentials, no side effects)
 * and makes the whole build trivially testable.
 */

export type SiteFile = {
	path: string;
	content: string;
};

export class VirtualFileSystem {
	private readonly files = new Map<string, string>();

	/** Create or overwrite a file. Returns the normalized path actually used. */
	write(path: string, content: string): string {
		const normalized = normalizePath(path);
		this.files.set(normalized, content);

		return normalized;
	}

	/** Full content of one file, or null when it does not exist. */
	read(path: string): string | null {
		return this.files.get(normalizePath(path)) ?? null;
	}

	/** Lightweight listing for the agent (paths + sizes, never contents). */
	list(): Array<{ bytes: number; path: string }> {
		return [...this.files.entries()].map(([path, content]) => ({
			bytes: Buffer.byteLength(content, "utf-8"),
			path,
		}));
	}

	/** Final snapshot handed to the uploader. */
	toFiles(): SiteFile[] {
		return [...this.files.entries()].map(([path, content]) => ({
			content,
			path,
		}));
	}
}

/**
 * Keys must be safe as R2 object-key segments: relative, forward slashes,
 * no traversal. Throwing (instead of silently fixing) turns a hallucinated
 * path into a tool error the model can read and correct.
 */
function normalizePath(path: string): string {
	const cleaned = path.trim().replace(/^\.?\//, "");

	if (cleaned.length === 0) {
		throw new Error("File path is empty");
	}

	if (cleaned.includes("\\")) {
		throw new Error(`Use forward slashes in paths (got: ${path})`);
	}

	if (
		cleaned.split("/").some((segment) => segment === ".." || segment === "")
	) {
		throw new Error(
			`Path may not contain ".." or empty segments (got: ${path})`,
		);
	}

	return cleaned;
}
