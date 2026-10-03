/**
 * Shared contract of the V2 web app publish (WANDIT-178).
 * The API answers these shapes on `/api/v2/projects/:id/publish`, and the
 * web publish popover parses them. The `publish-app` task parses the build
 * config of the sandbox and the stored build output with the last schemas.
 * The edge imports `publish.ts` by path, so the zod schemas live here.
 */
import { z } from "zod";
import {
	deploymentSlugSchema,
	deploymentStatusSchema,
} from "../v1/deployments";
import { isoDateTimeSchema, uuidSchema } from "../v1/shared/primitives";
import { commitShaSchema } from "./versions";
import type { WorkerModuleContentType } from "./workers-for-platforms";

// --- Build rows ------------------------------------------------------------

/** Lifecycle of one publish attempt. Matches the `app_build_status` DB enum. */
export const appBuildStatuses = [
	"queued",
	"building",
	"uploading",
	"published",
	"blocked",
	"failed",
] as const;

/** Runtime validator for a publish attempt status. */
export const appBuildStatusSchema = z.enum(appBuildStatuses);

/** TypeScript publish attempt status. */
export type AppBuildStatus = z.infer<typeof appBuildStatusSchema>;

/**
 * The statuses of a publish attempt that has not ended. Copies the partial
 * index `app_builds_live_project_uq`; change both together.
 */
export const liveAppBuildStatuses = [
	"queued",
	"building",
	"uploading",
] as const satisfies readonly AppBuildStatus[];

/**
 * Why a publish attempt failed. The task and the API write one of these to
 * `app_builds.error_code`; the popover shows a translated text per code.
 */
export const appBuildErrorCodes = [
	// The API could not hand the publish to Trigger.dev.
	"start_failed",
	// The install or the build in the sandbox failed or timed out.
	"build_failed",
	// The build output has no Worker config, a symlink, or a bad path.
	"output_invalid",
	// The build output has too many files or too many bytes.
	"output_too_large",
	// A rollback found no stored output of its source build.
	"source_missing",
	// The publish gate refused the build output.
	"gate_blocked",
	// Another live site took the slug between the check and the promotion.
	"slug_taken",
	// A Workers for Platforms or KV call failed.
	"upload_failed",
	// A Cloudflare or R2 env value is not set on the worker.
	"unconfigured",
	// Any other error of the task.
	"internal",
] as const;

/** Runtime validator for a publish error code. */
export const appBuildErrorCodeSchema = z.enum(appBuildErrorCodes);

/** TypeScript publish error code. */
export type AppBuildErrorCode = z.infer<typeof appBuildErrorCodeSchema>;

/** One publish attempt as the API answers it. */
export const appBuildSchema = z.object({
	id: uuidSchema,
	projectId: uuidSchema,
	status: appBuildStatusSchema,
	/** The commit the attempt publishes. */
	commitSha: commitShaSchema,
	/** Set on a rollback: the build whose stored output goes up again. */
	sourceBuildId: uuidSchema.nullable(),
	/** Set only on a `failed` or `blocked` attempt. The English detail stays in the row. */
	errorCode: appBuildErrorCodeSchema.nullable(),
	createdAt: isoDateTimeSchema,
	/** When the attempt reached `published`, `blocked`, or `failed`. */
	completedAt: isoDateTimeSchema.nullable(),
});

/** TypeScript publish attempt. */
export type AppBuild = z.infer<typeof appBuildSchema>;

/** One row of the publish history: a `deployments` row of kind `app`. */
export const appDeploymentSchema = z.object({
	id: uuidSchema,
	/** `active` is the live row; `superseded` and `unpublished` rows can roll back. */
	status: deploymentStatusSchema,
	slug: deploymentSlugSchema,
	commitSha: commitShaSchema,
	/** The `app_builds` row that uploaded this deployment. */
	buildId: uuidSchema,
	createdAt: isoDateTimeSchema,
});

/** TypeScript app deployment. */
export type AppDeployment = z.infer<typeof appDeploymentSchema>;

/** The live app: the active deployment and its public URL. */
export const appLiveSchema = z.object({
	deploymentId: uuidSchema,
	/** `https://{slug}.{SITES_DOMAIN}`. The web shows it as a link. */
	url: z.url({ protocol: /^https$/ }),
	slug: deploymentSlugSchema,
	commitSha: commitShaSchema,
	/** When the active row went live. */
	publishedAt: isoDateTimeSchema,
});

/** TypeScript live app. */
export type AppLive = z.infer<typeof appLiveSchema>;

/** How many deployments `GET .../publish` answers in `history`. */
export const APP_PUBLISH_HISTORY_LIMIT = 20;

/**
 * Answer of `GET /api/v2/projects/:id/publish` and of the unpublish route.
 * The popover polls it while `latestBuild` is live.
 */
export const appPublishStatusSchema = z.object({
	/** Null when nothing is live. */
	live: appLiveSchema.nullable(),
	/** The newest publish attempt, or null before the first publish. */
	latestBuild: appBuildSchema.nullable(),
	/** The newest app deployments, newest first, at most `APP_PUBLISH_HISTORY_LIMIT`. */
	history: z.array(appDeploymentSchema),
});

/** TypeScript publish status. */
export type AppPublishStatus = z.infer<typeof appPublishStatusSchema>;

/** Body of `POST /api/v2/projects/:id/publish`. */
export const publishAppBodySchema = z.object({
	/** A new uuid per click. A retried request with the same key answers the same build. */
	requestKey: uuidSchema,
});

/** TypeScript publish body. */
export type PublishAppBody = z.infer<typeof publishAppBodySchema>;

/** Body of `POST /api/v2/projects/:id/publish/rollback`. */
export const rollbackAppBodySchema = z.object({
	/** An earlier app deployment of the same project. */
	deploymentId: uuidSchema,
	/** A new uuid per click, like the publish body. */
	requestKey: uuidSchema,
});

/** TypeScript rollback body. */
export type RollbackAppBody = z.infer<typeof rollbackAppBodySchema>;

const publishBase = (projectId: string) =>
	`/api/v2/projects/${projectId}/publish`;

/** Every publish route. All need the workspace header. */
export const appPublishRoutes = {
	// GET the publish status; POST publishes the saved head; DELETE unpublishes.
	publish: (projectId: string) => publishBase(projectId),
	// POST uploads the stored output of an earlier deployment again.
	rollback: (projectId: string) => `${publishBase(projectId)}/rollback`,
} as const;

// --- Build output ----------------------------------------------------------

/**
 * The fields of `dist/server/wrangler.json` that the task reads. The
 * Cloudflare Vite plugin writes this file in the sandbox, so the task
 * parses it like any other untrusted input.
 */
export const appWorkerConfigSchema = z.object({
	/** Entry module, relative to `dist/server`, for example `index.js`. */
	main: z.string().min(1),
	/** Workers runtime date, for example "2026-09-01". */
	compatibility_date: z.iso.date(),
	compatibility_flags: z.array(z.string().min(1)).default([]),
});

/** Module part types the publish task uploads. A subset of `WorkerModuleContentType`. */
export const storedModuleTypes = [
	"application/javascript+module",
	"application/wasm",
] as const satisfies readonly WorkerModuleContentType[];

/** One file of the stored output: its path and its bytes in base64. */
const storedFileSchema = z.object({
	/** Path relative to the output folder, without a leading `/`. */
	path: z.string().min(1),
	contentBase64: z.base64(),
});

/**
 * The output of one build, stored in R2 as gzip JSON. A rollback reads it
 * back and uploads it again, because the namespace API keeps no versions.
 */
export const storedAppBuildSchema = z.object({
	/** Changes when the stored shape changes. */
	formatVersion: z.literal(1),
	mainModule: z.string().min(1),
	compatibilityDate: z.iso.date(),
	compatibilityFlags: z.array(z.string().min(1)),
	modules: z.array(
		storedFileSchema.extend({ type: z.enum(storedModuleTypes) }),
	),
	assets: z.array(storedFileSchema),
});

/** TypeScript stored build output. */
export type StoredAppBuild = z.infer<typeof storedAppBuildSchema>;
