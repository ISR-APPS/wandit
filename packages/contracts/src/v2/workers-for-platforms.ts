/**
 * Schemas and input types of the Workers for Platforms (W4P) REST calls.
 * The server client `workers-for-platforms.client.ts` parses every answer
 * with them; its header lists the paths. The publish task (WANDIT-178)
 * builds `WorkerDeployInput`. The namespace API has no versions endpoints.
 */
import { z } from "zod";

import type { AppWorkerLimits } from "./publish";

/** One entry of `errors` in a Cloudflare answer. `code` is a Cloudflare number, for example 10007 for a missing script. */
export const cloudflareApiErrorSchema = z.object({
	code: z.number().int(),
	message: z.string(),
});

/** One parsed Cloudflare error; `WorkersForPlatformsError.errors` holds a list of them. */
export type CloudflareApiError = z.infer<typeof cloudflareApiErrorSchema>;

/**
 * Builds the schema of the Cloudflare v4 envelope around one result schema.
 * A failure answer parses too: `success: false`, the errors, and `result: null`.
 */
export function cloudflareEnvelopeSchema<T extends z.ZodType>(result: T) {
	return z.object({
		success: z.boolean(),
		errors: z.array(cloudflareApiErrorSchema),
		result: result.nullable(),
	});
}

/** The error list of a non-2xx answer. The client reads nothing else from a failed call. */
export const cloudflareErrorBodySchema = z.object({
	errors: z.array(cloudflareApiErrorSchema),
});

/**
 * One file of the asset manifest. `hash` is 32 hex characters, the length
 * Cloudflare requires; `size` is the file length in bytes.
 */
export const assetManifestEntrySchema = z.object({
	hash: z.string().regex(/^[0-9a-f]{32}$/),
	size: z.number().int().nonnegative(),
});

/** One manifest entry; `assetManifest` in the server builds it from the file bytes. */
export type AssetManifestEntry = z.infer<typeof assetManifestEntrySchema>;

/** Body field `manifest` of the upload session. Key: the URL path of the file, starting with `/`. */
export type AssetManifest = Record<string, AssetManifestEntry>;

/**
 * Result of `POST .../scripts/{script}/assets-upload-session`. The jwt is valid for one hour. Each inner
 * array of `buckets` is one upload request. Empty buckets mean Cloudflare
 * has every file, and the jwt is then the completion token.
 */
export const assetUploadSessionResultSchema = z.object({
	jwt: z.string().min(1),
	buckets: z.array(z.array(z.string())).default([]),
});

/** Parsed upload session; `uploadAssets` takes it as it is. */
export type AssetUploadSession = z.infer<typeof assetUploadSessionResultSchema>;

/** Result of one `POST .../workers/assets/upload`: 202 answers `{}`, the 201 after the last file answers the completion jwt. */
export const assetUploadResultSchema = z.object({
	jwt: z.string().min(1).optional(),
});

/**
 * Result of the script upload `PUT .../scripts/{script}`. `id` is the script name. `etag` is the hash
 * of the script content; the namespace API answers no version id.
 */
export const workerScriptUploadResultSchema = z.object({
	id: z.string(),
	etag: z.string(),
	tags: z.array(z.string()).nullish(),
});

/** One item of `GET .../scripts`. `script.id` is the script name; Cloudflare answers null for no tags. */
export const namespaceScriptSchema = z.object({
	created_on: z.string(),
	script: z.object({
		id: z.string(),
		tags: z.array(z.string()).nullish(),
	}),
});

/**
 * One binding in the `metadata` part of the script upload. The fields are
 * the Cloudflare field names, so the client sends the value as it is.
 */
export type WorkerBinding =
	/** An env value the dashboard shows, for example a public URL. */
	| { type: "plain_text"; name: string; text: string }
	/** A write-only env value. The app secrets travel here, never in a file of the build. */
	| { type: "secret_text"; name: string; text: string }
	/** Gives the Worker code a fetcher of its own static assets. */
	| { type: "assets"; name: string };

/** Content types the script upload accepts for a module part (a subset of the documented list). */
export type WorkerModuleContentType =
	| "application/javascript+module"
	| "application/source-map"
	| "application/wasm"
	| "text/plain"
	| "application/octet-stream";

/** One file of the Worker code, sent as one multipart part. */
export type WorkerModule = {
	/** Part name and file name, relative to the build output root, for example `index.js`. */
	path: string;
	/** The file bytes. */
	content: Uint8Array;
	/** Content type of the part. */
	type: WorkerModuleContentType;
};

/**
 * Everything `deployScript` sends besides the scope. The scope carries the
 * script name. The client builds the tags, so no caller can drop the
 * project tag that the orphan sweep reads.
 */
export type WorkerDeployInput = {
	/** Entry module. It must equal the `path` of one entry in `modules`. */
	mainModule: string;
	/** The Worker code from the build output. */
	modules: WorkerModule[];
	/** Env values of the app. The app secrets travel here as `secret_text`. */
	bindings: WorkerBinding[];
	/** Value of the `customer:` tag: the organization id, or the user id of a personal project. */
	workspaceId: string;
	/** Per-request ceilings, sent as `limits: { cpu_ms, subrequests }`. */
	limits: AppWorkerLimits;
	/** Workers runtime date, for example "2025-10-11". */
	compatibilityDate: string;
	/** Workers runtime flags, for example ["nodejs_compat"]. */
	compatibilityFlags: string[];
	/** Completion jwt from the asset upload. */
	assetsJwt: string;
};

/** Start of the tag that ties a user Worker to its project. The orphan sweep reads the id after it. */
export const APP_WORKER_PROJECT_TAG_PREFIX = "project:";

/**
 * Tags of the user Worker of one project. The orphan sweep reads the
 * project tag; a filter on the customer tag finds the Workers of one
 * workspace. Cloudflare allows 8 tags per script.
 */
export function appWorkerTags(
	projectId: string,
	workspaceId: string,
): string[] {
	return [
		`${APP_WORKER_PROJECT_TAG_PREFIX}${projectId}`,
		`customer:${workspaceId}`,
	];
}
