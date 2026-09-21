/**
 * Shared contract for V2 app versions.
 *
 * One version is one git commit on the project's code.storage repository
 * (D21). The API lists versions, serves the stored patch of one version,
 * and restores a version as a new copy-forward commit.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";

/**
 * A full git commit sha: 40 lowercase hex characters. The API only accepts
 * the sha form `git rev-parse HEAD` prints.
 */
export const commitShaSchema = z
	.string()
	.regex(/^[0-9a-f]{40}$/, "expected a 40-character commit sha");

/**
 * What made the commit. Matches the `app_commit_source` database enum
 * (WANDIT-163).
 */
export const appCommitSources = ["agent", "restore", "wip", "merge"] as const;

/** Runtime validator for an app commit source. */
export const appCommitSourceSchema = z.enum(appCommitSources);

/** TypeScript app commit source type. */
export type AppCommitSource = z.infer<typeof appCommitSourceSchema>;

/**
 * One file's change counts in a commit, parsed from `git show --numstat`.
 * Binary files store 0 and 0 because git prints `-` for them.
 */
export const appCommitNumstatEntrySchema = z.object({
	path: z.string(),
	insertions: z.int().nonnegative(),
	deletions: z.int().nonnegative(),
});

/** TypeScript numstat entry type. */
export type AppCommitNumstatEntry = z.infer<typeof appCommitNumstatEntrySchema>;

/**
 * Validator for a whole numstat list — the shape stored in the
 * `app_commits.numstat` jsonb column and in the R2 `.numstat` object.
 */
export const appCommitNumstatListSchema = z.array(appCommitNumstatEntrySchema);

/**
 * One version in the list answer: the `app_commits` row fields the versions
 * panel needs. `numstat` is null on rows written before the numstat capture
 * existed.
 */
export const appCommitSchema = z.object({
	sha: commitShaSchema,
	parentSha: commitShaSchema.nullable(),
	message: z.string(),
	source: appCommitSourceSchema,
	restoredFromSha: commitShaSchema.nullable(),
	// Id of the builder_turns row; null on restores, which are not turns.
	turnId: uuidSchema.nullable(),
	// Id of the assistant message that produced the commit; "restore-<uuid>"
	// on restores.
	messageId: z.string().nullable(),
	numstat: z.array(appCommitNumstatEntrySchema).nullable(),
	createdAt: isoDateTimeSchema,
});

/** TypeScript app commit (one version). */
export type AppCommit = z.infer<typeof appCommitSchema>;

/**
 * Query of `GET /api/v2/projects/:id/versions`. `cursor` is the opaque
 * `nextCursor` of the previous answer; `limit` caps the page at 50 rows.
 */
export const listVersionsQuerySchema = z.object({
	cursor: z.string().trim().min(1).max(1_000).optional(),
	// Query params arrive as strings, so the number needs coercion.
	limit: z.coerce.number().int().min(1).max(50).default(50),
});

/** TypeScript list-versions query. */
export type ListVersionsQuery = z.infer<typeof listVersionsQuerySchema>;

/**
 * Answer of `GET /api/v2/projects/:id/versions`, newest first.
 * `nextCursor` is null when the list reached the oldest version.
 */
export const listVersionsResponseSchema = z.object({
	items: z.array(appCommitSchema),
	nextCursor: z.string().nullable(),
});

/** TypeScript list-versions response. */
export type ListVersionsResponse = z.infer<typeof listVersionsResponseSchema>;

/**
 * Answer of `GET /api/v2/projects/:id/versions/:sha/diff`. `patch` is the
 * stored `git show` output, capped at 1 MB at write time.
 */
export const versionDiffResponseSchema = z.object({
	sha: commitShaSchema,
	patch: z.string(),
	numstat: z.array(appCommitNumstatEntrySchema),
});

/** TypeScript version-diff response. */
export type VersionDiffResponse = z.infer<typeof versionDiffResponseSchema>;

/**
 * Body of `POST /api/v2/projects/:id/versions/:sha/restore`. The client
 * sends the head sha it saw; a stale value answers 409 VERSION_CONFLICT.
 */
export const restoreVersionBodySchema = z.object({
	/** Head sha the client last listed. Compare-and-swap input. */
	expectedHeadSha: commitShaSchema,
});

/** TypeScript restore-version body. */
export type RestoreVersionBody = z.infer<typeof restoreVersionBodySchema>;

/**
 * Answer of `POST .../restore`: the new copy-forward commit. History keeps
 * every older commit; this commit carries `restoredFromSha`.
 */
export const restoreVersionResponseSchema = z.object({
	commit: appCommitSchema,
});

/** TypeScript restore-version response. */
export type RestoreVersionResponse = z.infer<
	typeof restoreVersionResponseSchema
>;
