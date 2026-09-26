/**
 * Shared contract for V2 mobile builds on EAS (WANDIT-194).
 * The API answers the build shapes on `/api/v2/projects/:id/mobile-builds`,
 * and the Android card of the web publish popover parses them. The `mobile-build` task
 * parses the EAS answers and the Expo project files with the other schemas.
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";
import { commitShaSchema } from "./versions";

// --- Build rows ------------------------------------------------------------

/** Target OS of a build. Matches the `mobile_build_platform` DB enum. */
export const mobileBuildPlatforms = ["android", "ios"] as const;

/** Runtime validator for a build platform. */
export const mobileBuildPlatformSchema = z.enum(mobileBuildPlatforms);

/** TypeScript build platform. */
export type MobileBuildPlatform = z.infer<typeof mobileBuildPlatformSchema>;

/** What a build makes. Matches the `mobile_build_kind` DB enum. */
export const mobileBuildKinds = ["apk", "ios_store"] as const;

/** Runtime validator for a build kind. */
export const mobileBuildKindSchema = z.enum(mobileBuildKinds);

/** TypeScript build kind. */
export type MobileBuildKind = z.infer<typeof mobileBuildKindSchema>;

/** Lifecycle of a build. Matches the `mobile_build_status` DB enum. */
export const mobileBuildStatuses = [
	"queued",
	"building",
	"finished",
	"failed",
	"canceled",
] as const;

/** Runtime validator for a build status. */
export const mobileBuildStatusSchema = z.enum(mobileBuildStatuses);

/** TypeScript build status. */
export type MobileBuildStatus = z.infer<typeof mobileBuildStatusSchema>;

/**
 * The statuses of a build that has not ended. Copies the partial index
 * `mobile_builds_live_project_platform_uq`; change both together.
 */
export const liveMobileBuildStatuses = [
	"queued",
	"building",
] as const satisfies readonly MobileBuildStatus[];

/**
 * Why a build failed. The task and the API write one of these to
 * `mobile_builds.error_code`; the panel shows a translated text per code.
 */
export const mobileBuildErrorCodes = [
	// The API could not hand the build to Trigger.dev.
	"start_failed",
	// EXPO_TOKEN or EXPO_ACCOUNT is not set on the worker.
	"unconfigured",
	// The worker could not fetch the commit from code.storage.
	"clone_failed",
	// app.json is missing or invalid, or the app has a dynamic app.config file.
	"config_invalid",
	// app.json names a config plugin outside the allowed modules.
	"plugin_not_allowed",
	// The install of the trusted template dependencies failed.
	"install_failed",
	// `eas init` could not create or link the EAS project.
	"eas_init_failed",
	// `eas build` could not queue the build.
	"eas_start_failed",
	// EAS reported the build as ERRORED.
	"eas_errored",
	// EAS reported FINISHED without an APK URL.
	"artifact_missing",
	// The build did not end before the poll ceiling of the task.
	"timeout",
	// Any other error of the task.
	"internal",
] as const;

/** Runtime validator for a build error code. */
export const mobileBuildErrorCodeSchema = z.enum(mobileBuildErrorCodes);

/** TypeScript build error code. */
export type MobileBuildErrorCode = z.infer<typeof mobileBuildErrorCodeSchema>;

/**
 * Price of one Android APK build, in whole credits. D23 default of Zack,
 * ESTIMATE. At $0.032 per credit (D2) it is $0.80; EAS charges $1 to $2
 * per Android build after the 15 free builds of a month.
 */
export const MOBILE_BUILD_ANDROID_CREDITS = 25;

/** One build as the API answers it. */
export const mobileBuildSchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	platform: mobileBuildPlatformSchema,
	kind: mobileBuildKindSchema,
	status: mobileBuildStatusSchema,
	/** The commit the build uses: the head of `main` at request time. */
	commitSha: commitShaSchema,
	/**
	 * Direct APK download URL. Set only on a `finished` build. The web puts
	 * it in a link and a QR code, so only `https` passes.
	 */
	artifactUrl: z.url({ protocol: /^https$/ }).nullable(),
	/**
	 * Set only on a `failed` build. The web shows a translated text per code;
	 * the English detail stays in `mobile_builds.error_message` for support.
	 */
	errorCode: mobileBuildErrorCodeSchema.nullable(),
	createdAt: isoDateTimeSchema,
	/** When the build reached `finished`, `failed`, or `canceled`. */
	completedAt: isoDateTimeSchema.nullable(),
});

/** TypeScript build. */
export type MobileBuild = z.infer<typeof mobileBuildSchema>;

/**
 * Body of `POST /api/v2/projects/:id/mobile-builds`. Only Android builds
 * run now; iOS joins with WANDIT-284.
 */
export const createMobileBuildBodySchema = z.object({
	platform: z.literal("android"),
	/** A new uuid per click. A retried request with the same key answers the same build. */
	requestKey: uuidSchema,
});

/** TypeScript create-build body. */
export type CreateMobileBuildBody = z.infer<typeof createMobileBuildBodySchema>;

/**
 * Query of `GET /api/v2/projects/:id/mobile-builds`. `cursor` is the opaque
 * `nextCursor` of the previous answer; `limit` caps the page at 50 rows.
 */
export const listMobileBuildsQuerySchema = z.object({
	cursor: z.string().trim().min(1).max(1_000).optional(),
	// Query params arrive as strings, so the number needs coercion.
	limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** TypeScript list-builds query. */
export type ListMobileBuildsQuery = z.infer<typeof listMobileBuildsQuerySchema>;

/**
 * Answer of `GET /api/v2/projects/:id/mobile-builds`, newest first.
 * `nextCursor` is null on the last page.
 */
export const listMobileBuildsResponseSchema = z.object({
	items: z.array(mobileBuildSchema),
	nextCursor: z.string().nullable(),
});

/** TypeScript list-builds response. */
export type ListMobileBuildsResponse = z.infer<
	typeof listMobileBuildsResponseSchema
>;

const mobileBuildsBase = (projectId: string) =>
	`/api/v2/projects/${projectId}/mobile-builds`;

/** Every mobile build route. All need the workspace header and `project:update`. */
export const mobileBuildRoutes = {
	// GET the build history; POST starts a build.
	list: (projectId: string) => mobileBuildsBase(projectId),
	// GET one build.
	build: (projectId: string, buildId: string) =>
		`${mobileBuildsBase(projectId)}/${buildId}`,
	// POST cancels one build; a build that already ended answers as it is.
	cancel: (projectId: string, buildId: string) =>
		`${mobileBuildsBase(projectId)}/${buildId}/cancel`,
} as const;

// --- EAS answers -----------------------------------------------------------

/** Build status of the EAS GraphQL `BuildStatus` enum (eas-cli 24.8.0). */
export const easBuildStatuses = [
	"NEW",
	"IN_QUEUE",
	"IN_PROGRESS",
	"PENDING_CANCEL",
	"FINISHED",
	"ERRORED",
	"CANCELED",
] as const;

/** Runtime validator for an EAS build status. */
export const easBuildStatusSchema = z.enum(easBuildStatuses);

/** TypeScript EAS build status. */
export type EasBuildStatus = z.infer<typeof easBuildStatusSchema>;

/**
 * The fields of one EAS build that wandit reads. `eas build --json` drops
 * every null key and GraphQL sends null, so each optional field is nullish.
 */
export const easBuildSchema = z.object({
	id: z.string().min(1),
	status: easBuildStatusSchema,
	/**
	 * `buildUrl` is the direct APK URL of an internal Android build. Only
	 * `https` passes: the URL reaches a link and a QR code in the web.
	 */
	artifacts: z
		.object({ buildUrl: z.url({ protocol: /^https$/ }).nullish() })
		.nullish(),
	error: z.object({ errorCode: z.string(), message: z.string() }).nullish(),
});

/** TypeScript EAS build. */
export type EasBuild = z.infer<typeof easBuildSchema>;

/** Stdout of `eas build --no-wait --json`: one build per platform. */
export const easBuildStartOutputSchema = z.array(easBuildSchema).min(1);

/** Stdout of `eas init --json`. Only the project id is read. */
export const easInitOutputSchema = z.object({ projectId: z.string().min(1) });

/** One entry of the `errors` array of an EAS GraphQL answer. */
export const easGraphqlErrorSchema = z.object({ message: z.string() });

/** Answer of the `BuildsByIdQuery` GraphQL query. */
export const easBuildViewResponseSchema = z.object({
	data: z.object({ builds: z.object({ byId: easBuildSchema }) }).nullish(),
	errors: z.array(easGraphqlErrorSchema).optional(),
});

/** Answer of the `CancelBuildMutation` GraphQL mutation. */
export const easBuildCancelResponseSchema = z.object({
	data: z
		.object({
			build: z.object({
				cancelBuild: z.object({ id: z.string(), status: easBuildStatusSchema }),
			}),
		})
		.nullish(),
	errors: z.array(easGraphqlErrorSchema).optional(),
});

// --- Expo project files ----------------------------------------------------

/**
 * One `plugins` entry of app.json: a module name, or the name and its
 * options. The options pass through to EAS unread.
 */
export const expoPluginEntrySchema = z.union([
	z.string().min(1),
	z.tuple([z.string().min(1)], z.unknown()),
]);

/** TypeScript app.json plugin entry. */
export type ExpoPluginEntry = z.infer<typeof expoPluginEntrySchema>;

/**
 * The `expo` object of a user app.json. The task reads `plugins` and
 * rewrites `slug`, `owner`, `android`, and `extra`; every other key passes
 * through to EAS unread.
 */
export const expoAppConfigSchema = z.looseObject({
	name: z.string().min(1),
	plugins: z.array(expoPluginEntrySchema).optional(),
	android: z.looseObject({}).optional(),
	extra: z.looseObject({}).optional(),
});

/** TypeScript app.json `expo` object. */
export type ExpoAppConfig = z.infer<typeof expoAppConfigSchema>;

/** A user app.json. */
export const expoAppJsonSchema = z.looseObject({ expo: expoAppConfigSchema });

/** TypeScript app.json. */
export type ExpoAppJson = z.infer<typeof expoAppJsonSchema>;

/**
 * The template eas.json. The task writes the APK env into `build.apk.env`;
 * the other keys pass through unread.
 */
export const easJsonSchema = z.looseObject({
	build: z.looseObject({
		apk: z.looseObject({ env: z.record(z.string(), z.string()).optional() }),
	}),
});

/** TypeScript eas.json. */
export type EasJson = z.infer<typeof easJsonSchema>;

/**
 * The one field of a user package.json that the build checks. Any value of
 * `exports` is refused, so the value has no inner schema.
 */
export const appPackageJsonSchema = z.object({ exports: z.json().optional() });

/** The template package.json: the direct dependencies and their exact versions. */
export const templatePackageJsonSchema = z.looseObject({
	dependencies: z.record(z.string(), z.string()),
});

/** TypeScript template package.json. */
export type TemplatePackageJson = z.infer<typeof templatePackageJsonSchema>;

/**
 * The template native-modules.json: every module the sandbox allows, with
 * the version range of the pinned Expo SDK.
 */
export const nativeModulesJsonSchema = z.looseObject({
	native: z.record(z.string(), z.string()),
});

/** TypeScript native-modules.json. */
export type NativeModulesJson = z.infer<typeof nativeModulesJsonSchema>;
