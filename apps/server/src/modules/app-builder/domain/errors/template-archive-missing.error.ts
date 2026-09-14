/**
 * Plain domain error: the template archive the sandbox needs is absent.
 * `ArchiveTemplateInit` throws it with the path it tried, so the operator
 * sees which file WANDIT-168 must produce.
 */

/** Thrown when the template archive cannot be read from disk. */
export class TemplateArchiveMissingError extends Error {
	constructor(path: string, cause: unknown) {
		super(`Template archive is missing or unreadable: ${path}`, { cause });
		this.name = "TemplateArchiveMissingError";
	}
}
