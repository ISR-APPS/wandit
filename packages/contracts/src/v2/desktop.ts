/**
 * Shared contract for V2 desktop apps: a Tauri app for Windows and macOS with
 * a local SQLite database (docs/v2/desktop-apps.md).
 * The API answers the desktop shapes on `/api/v2/projects/:id/desktop`, and
 * the Release popover of the web app parses them. The `desktop-build` task,
 * the migration gate, and the `add_local_migration` host tool read the
 * migration rules. The GitHub and updater manifest shapes are here too.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";
import { appSuspensionSchema } from "./app-publish";
import { commitShaSchema } from "./versions";

// --- Local migrations ------------------------------------------------------

/** Project-relative folder of the SQLite migration files of a desktop app. */
export const DESKTOP_MIGRATIONS_DIR = "migrations";

/**
 * File name of one migration: a 4-digit version, then a snake_case name.
 * Group 1 is the version, group 2 is the name. Example: `0002_add_customers.sql`.
 */
export const DESKTOP_MIGRATION_FILE_PATTERN =
	/^(\d{4})_([a-z][a-z0-9_]{0,59})\.sql$/;

/**
 * Line 1 of a replacement migration (docs/v2/desktop-apps.md section 5).
 * The host tool writes it. The gate, the Rust shell, and the preview read it.
 */
export const DESKTOP_MIGRATION_REPLACES_PATTERN =
	/^-- wandit:replaces (\d{4})\n/;

/** What line 1 of a migration says. `invalid`: a bad `-- wandit:` line, which the gate refuses. */
export type DesktopMigrationHeader =
	| { kind: "plain" }
	// `version` is the version of the frozen file that this file replaces, from 1 to 9999.
	| { kind: "replaces"; version: number }
	| { kind: "invalid" };

/**
 * Reads the header of a migration text. Only line 1 may hold a `-- wandit:` line, and only
 * as `-- wandit:replaces NNNN` with an LF. The Rust shell and the preview copy these rules.
 */
export function parseDesktopMigrationHeader(
	sql: string,
): DesktopMigrationHeader {
	const match = DESKTOP_MIGRATION_REPLACES_PATTERN.exec(sql);
	const rest = match === null ? sql : sql.slice(match[0].length);
	// A typo, a CRLF, or a marker on a later line would make a plain file in one reader.
	if (rest.split("\n").some((line) => line.startsWith("-- wandit:"))) {
		return { kind: "invalid" };
	}
	if (match === null) {
		return { kind: "plain" };
	}
	const version = Number(match[1]);
	return version === 0 ? { kind: "invalid" } : { kind: "replaces", version };
}

/** The `name` part of a migration file name. The host tool input uses it too. */
export const desktopMigrationNameSchema = z
	.string()
	.regex(
		/^[a-z][a-z0-9_]{0,59}$/,
		"Use a-z, 0-9, and _; start with a letter; at most 60 characters",
	);

/** Largest migration file, in bytes of UTF-8: 256 KB. A seed of 1,000 rows fits. */
export const DESKTOP_MIGRATION_MAX_BYTES = 256 * 1024;

/** Most migration files in one app. Version 0001 to 9999 limits it too. */
export const DESKTOP_MIGRATIONS_MAX_COUNT = 500;

/** Largest sum of all migration files, in bytes: 4 MB. */
export const DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/**
 * Reads the version and the name of a migration file name. Answers null
 * when the name breaks `DESKTOP_MIGRATION_FILE_PATTERN` or the version is 0.
 */
export function parseDesktopMigrationFileName(
	fileName: string,
): { version: number; name: string } | null {
	const [, versionText, name] =
		DESKTOP_MIGRATION_FILE_PATTERN.exec(fileName) ?? [];
	const version = Number(versionText);
	if (name === undefined || version === 0) {
		return null;
	}
	return { name, version };
}

/**
 * Why the desktop gate refused a build or a migration. Every finding
 * blocks. The web shows a translated text per rule and the English
 * `message` for detail.
 */
export const desktopGateRules = [
	// A file in `migrations/` breaks the file name pattern.
	"migration_name_invalid",
	// Two files have the same version.
	"migration_duplicate_version",
	// A file is larger than DESKTOP_MIGRATION_MAX_BYTES, or the folder is too large.
	"migration_too_large",
	// A file holds no statement.
	"migration_empty",
	// A migration of an earlier build changed. Installed apps already ran the old text.
	"migration_released_changed",
	// A migration of an earlier build is missing.
	"migration_released_missing",
	// A new migration has a version below the last built version.
	"migration_version_order",
	// A statement is not on the allow list (for example DROP TABLE, DELETE,
	// PRAGMA, ATTACH, or an UPDATE of a column that an earlier build made).
	"migration_statement_refused",
	// The migrations fail on the test rows or on a new install.
	"migration_dry_run_failed",
	// A check (a top-level SELECT) did not answer one row with the integer 1, on the test rows or on a new install.
	"migration_check_failed",
	// A "-- wandit:" line is bad, or a replacement names a file that it cannot replace.
	"migration_replaces_invalid",
	// A replacement makes another schema than the file that it replaces.
	"migration_replaces_schema_differs",
	// The new migrations remove or change a table or column of an earlier build.
	"migration_schema_removed",
	// The frontend build holds a secret, for example an API key.
	"secret_in_frontend",
] as const;

/** Runtime validator of a gate rule. */
export const desktopGateRuleSchema = z.enum(desktopGateRules);

/** TypeScript gate rule. */
export type DesktopGateRule = z.infer<typeof desktopGateRuleSchema>;

/** One reason the gate refused a build or a migration. */
export const desktopGateFindingSchema = z.object({
	rule: desktopGateRuleSchema,
	/** Project-relative path, for example `migrations/0003_add_stock.sql` or `dist/assets/index.js`. */
	path: z.string().max(300),
	/** English detail for the user and for support. Never holds a secret value. */
	message: z.string().max(500),
});

/** TypeScript gate finding. */
export type DesktopGateFinding = z.infer<typeof desktopGateFindingSchema>;

/** Input of the `add_local_migration` host tool. */
export const addLocalMigrationToolInputSchema = z.object({
	/** The name part of the file. The host picks the next version number. */
	name: desktopMigrationNameSchema,
	/** The SQLite statements, separated by `;`. */
	sql: z
		.string()
		.min(1)
		.refine(
			(sql) =>
				new TextEncoder().encode(sql).length <= DESKTOP_MIGRATION_MAX_BYTES,
			`The migration is larger than ${DESKTOP_MIGRATION_MAX_BYTES} bytes`,
		),
	/**
	 * Version of a migration of an earlier build that this file replaces. The host writes
	 * line 1 "-- wandit:replaces NNNN". Leave it out for an ordinary migration.
	 */
	replaces: z.number().int().min(1).max(9999).optional(),
});

/** TypeScript `add_local_migration` input. */
export type AddLocalMigrationToolInput = z.infer<
	typeof addLocalMigrationToolInputSchema
>;

/** Output of the `add_local_migration` host tool. */
export const addLocalMigrationToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("added"),
			/** Project-relative path of the new file. */
			file: z.string(),
			version: z.number().int().positive(),
		}),
		z.object({
			status: z.literal("refused"),
			findings: z.array(desktopGateFindingSchema),
		}),
		z.object({
			status: z.literal("failed"),
			message: z.string(),
		}),
	],
);

/** TypeScript `add_local_migration` output. */
export type AddLocalMigrationToolOutput = z.infer<
	typeof addLocalMigrationToolOutputSchema
>;

// --- Builds ----------------------------------------------------------------

/** The desktop systems of a build. Windows: x86_64 NSIS. macOS: Apple silicon, 15 or later. */
export const desktopPlatforms = ["windows", "macos"] as const;

/** Runtime validator for a platform. Matches the `desktop_platform` DB enum. */
export const desktopPlatformSchema = z.enum(desktopPlatforms);

/** TypeScript platform. */
export type DesktopPlatform = z.infer<typeof desktopPlatformSchema>;

/** Lifecycle of a desktop build. Matches the `desktop_build_status` DB enum. */
export const desktopBuildStatuses = [
	// The API wrote the row and handed it to Trigger.dev.
	"queued",
	// The task builds the frontend in the sandbox and runs the gate.
	"preparing",
	// The desktop CI compiles the app and its download file.
	"building",
	// The task checks the CI files, signs the update file for the updater, and uploads them.
	"signing",
	// The download file is ready. A release makes it the live version of its platform.
	"ready",
	"failed",
	"canceled",
	// The gate refused the build. `findings` says why.
	"blocked",
] as const;

/** Runtime validator for a build status. */
export const desktopBuildStatusSchema = z.enum(desktopBuildStatuses);

/** TypeScript build status. */
export type DesktopBuildStatus = z.infer<typeof desktopBuildStatusSchema>;

/**
 * The statuses of a build that has not ended. Copies the partial index
 * `desktop_builds_live_project_uq`; change both together.
 */
export const liveDesktopBuildStatuses = [
	"queued",
	"preparing",
	"building",
	"signing",
] as const satisfies readonly DesktopBuildStatus[];

/**
 * Why a build failed. The task and the API write one of these to
 * `desktop_builds.error_code`; the popover shows a translated text per code.
 */
export const desktopBuildErrorCodes = [
	// The API could not hand the build to Trigger.dev.
	"start_failed",
	// A DESKTOP_* env value or the desktop shell archive is missing on the worker.
	"unconfigured",
	// The sandbox did not start, or the commit is not in it.
	"sandbox_failed",
	// `pnpm install` or `pnpm run build` failed in the sandbox.
	"frontend_build_failed",
	// The frontend output breaks a size, path, or file rule.
	"output_invalid",
	// A gate check could not run.
	"gate_unavailable",
	// The GitHub dispatch failed.
	"ci_start_failed",
	// The CI run ended with a failure or was canceled outside wandit.
	"ci_failed",
	// The built app failed the CI self-test: its migrations did not run on
	// a new database. A retry fails again, so the agent must fix the files.
	"self_test_failed",
	// The CI run ended, but a CI file (installer, disk image, or update archive) is missing or invalid.
	"artifact_invalid",
	// The updater signature could not be made or did not verify.
	"signing_failed",
	// An R2 upload failed.
	"upload_failed",
	// The build did not end before the poll ceiling of the task.
	"timeout",
	// Any other error of the task.
	"internal",
] as const;

/** Runtime validator for a build error code. */
export const desktopBuildErrorCodeSchema = z.enum(desktopBuildErrorCodes);

/** TypeScript build error code. */
export type DesktopBuildErrorCode = z.infer<typeof desktopBuildErrorCodeSchema>;

/**
 * Price of one desktop build, in whole credits (D31, default). At $0.032
 * per credit (D2) it is $0.80. A cold build on a 2-core Windows runner takes
 * about 35 minutes: 10 for tauri-cli and 25 for the shell. A cached build
 * takes about 8 minutes. A macOS build has the same price (D35). ESTIMATE:
 * a cached macOS build uses 5 to 8 minutes of a $0.062 runner.
 */
export const DESKTOP_BUILD_CREDITS = 25;

/**
 * Name of the app on Windows and macOS. It is the window title, the Start
 * menu entry, the install folder, and the `.app` name. Letters of any script,
 * digits, space, `.`, `_`, and `-`. No quote, `$`, or control character:
 * the NSIS script embeds it.
 */
export const desktopProductNameSchema = z
	.string()
	.trim()
	.min(2)
	.max(40)
	.regex(
		/^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N} ._-]*[\p{L}\p{M}\p{N}])?$/u,
		"Use letters, digits, spaces, dots, dashes, and underscores",
	);

/** One build as the API answers it. */
export const desktopBuildSchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	status: desktopBuildStatusSchema,
	/** The system that this build targets. It never changes. */
	platform: desktopPlatformSchema,
	/** Semver of the installed app, `1.0.<release number>`. The server picks it. */
	version: z.string(),
	/** The commit the build uses: the head of `main` at request time. */
	commitSha: commitShaSchema,
	/** Release notes from the user. The update dialog of the installed app shows them. */
	notes: z.string().nullable(),
	/**
	 * Download URL of the signed setup exe on Windows or of the disk image on
	 * macOS. Set only on a `ready` build. https only, because the web puts it
	 * in a link.
	 */
	installerUrl: z.url({ protocol: /^https$/ }).nullable(),
	/** Size of that download file in bytes. Set only on a `ready` build. */
	installerBytes: z.number().int().nonnegative().nullable(),
	/** Set only on a `failed` build. */
	errorCode: desktopBuildErrorCodeSchema.nullable(),
	/** Set only on a `blocked` build: the reasons of the gate. */
	findings: z.array(desktopGateFindingSchema),
	/** True when installed apps of this platform update to this build. */
	isCurrent: z.boolean(),
	createdAt: isoDateTimeSchema,
	/** When the build reached `ready`, `failed`, `canceled`, or `blocked`. */
	completedAt: isoDateTimeSchema.nullable(),
	/** The last time a release made this build current. */
	releasedAt: isoDateTimeSchema.nullable(),
});

/** TypeScript build. */
export type DesktopBuild = z.infer<typeof desktopBuildSchema>;

/** One platform of the app: its manifest, its stable download link, and its current build. */
const desktopPlatformReleaseSchema = z.object({
	/** URL of the updater manifest of this platform. Fixed in every app of this platform. */
	updatesUrl: z.url({ protocol: /^https$/ }),
	/** Stable download link of the current file. Null before the first release of this platform. */
	downloadUrl: z.url({ protocol: /^https$/ }).nullable(),
	/** The build that installed apps of this platform update to. Null before its first release. */
	currentBuildId: uuidSchema.nullable(),
});

/** The desktop identity of a project. It exists after the first build request. */
export const desktopAppSchema = z.object({
	/**
	 * App identifier, `app.wandit.p<project id hex>`. It names the data folder
	 * on both systems and is the macOS bundle id. It never changes.
	 */
	identifier: z.string(),
	/** Name of the app on both systems. Fixed at the first build. */
	productName: z.string(),
	/** Per platform. Each platform has its own manifest and release. */
	releases: z.object({
		windows: desktopPlatformReleaseSchema,
		macos: desktopPlatformReleaseSchema,
	}),
});

/** TypeScript desktop app. */
export type DesktopApp = z.infer<typeof desktopAppSchema>;

/** Query of `GET /api/v2/projects/:id/desktop`. `limit` caps the build list. */
export const desktopOverviewQuerySchema = z.object({
	// Query params arrive as strings, so the number needs coercion.
	limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** TypeScript overview query. */
export type DesktopOverviewQuery = z.infer<typeof desktopOverviewQuerySchema>;

/** Answer of `GET /api/v2/projects/:id/desktop`: the identity and the newest builds first. */
export const desktopOverviewResponseSchema = z.object({
	app: desktopAppSchema.nullable(),
	builds: z.array(desktopBuildSchema),
	/** Set while staff suspend the app. Create and release then answer 403 `PROJECT_SUSPENDED`. */
	suspension: appSuspensionSchema.nullable(),
	/** The platforms that the API builds now. macOS shows only when DESKTOP_MACOS_BUILDS_ENABLED is true. */
	buildablePlatforms: z.array(desktopPlatformSchema).min(1),
});

/** TypeScript overview response. */
export type DesktopOverviewResponse = z.infer<
	typeof desktopOverviewResponseSchema
>;

/** Max length of the release notes of one desktop build, in characters. The web notes field stops at it. */
export const desktopBuildNotesMaxLength = 500;

/** Body of `POST /api/v2/projects/:id/desktop/builds`. */
export const createDesktopBuildBodySchema = z.object({
	/** A new uuid per click. A retried request with the same key answers the same build. */
	requestKey: uuidSchema,
	/**
	 * The system to build. Required. A rebuild takes only the commit of
	 * `rebuildOfBuildId`, not its platform.
	 */
	platform: desktopPlatformSchema,
	/** Read only on the first build of a project. Unset: the project name. */
	productName: desktopProductNameSchema.optional(),
	/** Release notes. The update dialog of the installed app shows them. */
	notes: z.string().trim().max(desktopBuildNotesMaxLength).optional(),
	/**
	 * Id of an earlier `ready` build of the same project. The new build uses
	 * its commit and gets the next version, because installed apps accept only
	 * a newer version. Unset: the build uses the head of `main`.
	 */
	rebuildOfBuildId: uuidSchema.optional(),
});

/** TypeScript create-build body. */
export type CreateDesktopBuildBody = z.infer<
	typeof createDesktopBuildBodySchema
>;

const desktopBase = (projectId: string) =>
	`/api/v2/projects/${projectId}/desktop`;

/** Every desktop route. All need the workspace header; the POST routes need `project:update`. */
export const desktopRoutes = {
	// GET the identity and the build list.
	overview: (projectId: string) => desktopBase(projectId),
	// POST starts a build.
	builds: (projectId: string) => `${desktopBase(projectId)}/builds`,
	// POST cancels one build. A build that ended or that signs answers as it is.
	cancel: (projectId: string, buildId: string) =>
		`${desktopBase(projectId)}/builds/${buildId}/cancel`,
	// POST makes one `ready` build current. A build older than the current build of its platform answers 409.
	release: (projectId: string, buildId: string) =>
		`${desktopBase(projectId)}/builds/${buildId}/release`,
} as const;

// --- Updater manifest ------------------------------------------------------

/** One platform entry of the updater manifest. */
const desktopUpdatePlatformSchema = z.object({
	/** Content of the minisign `.sig` file: base64 of the 4-line signature text. */
	signature: z.string().min(1),
	url: z.url({ protocol: /^https$/ }),
});

/**
 * The static manifest that tauri-plugin-updater 2.x reads. One manifest per
 * platform: the signed version must equal `version`, so one file cannot hold
 * two versions. The plugin looks for `<os>-<arch>-<installer>` first, then
 * `<os>-<arch>`, so both keys carry the same entry. Each variant is strict: a
 * mixed or misspelled key set fails the parse and loses no key.
 */
export const desktopUpdateManifestSchema = z.object({
	version: z.string().min(1),
	notes: z.string().optional(),
	/** RFC 3339 time of the release. */
	pub_date: isoDateTimeSchema,
	platforms: z.union([
		z.strictObject({
			"windows-x86_64": desktopUpdatePlatformSchema,
			"windows-x86_64-nsis": desktopUpdatePlatformSchema,
		}),
		z.strictObject({
			"darwin-aarch64": desktopUpdatePlatformSchema,
			"darwin-aarch64-app": desktopUpdatePlatformSchema,
		}),
	]),
});

/** TypeScript updater manifest. */
export type DesktopUpdateManifest = z.infer<typeof desktopUpdateManifestSchema>;

// --- GitHub Actions answers ------------------------------------------------

/**
 * Answer of `POST .../actions/workflows/{id}/dispatches` with
 * `return_run_details: true` (GitHub, since 2026-02-19).
 */
export const githubDispatchResponseSchema = z.object({
	workflow_run_id: z.number().int().positive(),
	html_url: z.url(),
});

/** The fields of one workflow run that the desktop task reads. */
export const githubWorkflowRunSchema = z.object({
	id: z.number().int().positive(),
	/** `queued`, `in_progress`, `completed`, and the rarer waiting states. */
	status: z.string().min(1),
	/** Set when `status` is `completed`: `success`, `failure`, `cancelled`, and more. */
	conclusion: z.string().nullable(),
	html_url: z.url(),
});

/** TypeScript workflow run. */
export type GithubWorkflowRun = z.infer<typeof githubWorkflowRunSchema>;

/**
 * The fields of `GET .../actions/runs/{id}/jobs` that the desktop task
 * reads after a failed run: the step names and their conclusions.
 */
export const githubWorkflowJobsSchema = z.object({
	jobs: z.array(
		z.object({
			// Optional in the GitHub schema. A job without steps has no failed step.
			steps: z
				.array(
					z.object({
						name: z.string(),
						/** Set when the step ended: `success`, `failure`, `cancelled`, or `skipped`. */
						conclusion: z.string().nullable(),
					}),
				)
				.default([]),
		}),
	),
});
