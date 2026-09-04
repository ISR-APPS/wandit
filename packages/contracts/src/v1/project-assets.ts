/**
 * Project assets contracts — the workspace Assets tab.
 *
 * One ownership-checked list of every media file the AI produced for a
 * project, whatever pipeline made it: standalone image generations and the
 * images/videos found inside page builds. Each entry
 * is downloadable through the download route (public R2 URLs cannot force a
 * download cross-origin).
 */
import { z } from "zod";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

export const PROJECT_ASSET_KINDS = ["image", "video"] as const;

export const projectAssetKindSchema = z.enum(PROJECT_ASSET_KINDS);

export type ProjectAssetKind = z.infer<typeof projectAssetKindSchema>;

// Which pipeline produced the file — the Assets tab shows this as a badge.
export const projectAssetSourceSchema = z.enum([
	"image-generation",
	"page-build",
]);

export type ProjectAssetSource = z.infer<typeof projectAssetSourceSchema>;

export const projectAssetSchema = z.object({
	// Stable synthetic id (attempt id + index, or the R2 object key).
	id: z.string().min(1),
	kind: projectAssetKindSchema,
	name: z.string().min(1),
	url: z.url(),
	mediaType: z.string().min(1),
	source: projectAssetSourceSchema,
	// R2 object key, always inside this project's asset prefixes — the
	// download route re-validates it server-side before streaming.
	key: z.string().min(1),
	sizeBytes: z.number().int().nonnegative().nullable(),
	createdAt: isoDateTimeSchema.nullable(),
});

export type ProjectAsset = z.infer<typeof projectAssetSchema>;

export const projectAssetsResponseSchema = z.object({
	assets: z.array(projectAssetSchema),
});

export type ProjectAssetsResponse = z.infer<typeof projectAssetsResponseSchema>;

// Dashboard-level aggregate: one asset with its project attached, so the
// grid can label tiles, filter by project, and build the project-scoped
// download link.
export const workspaceAssetSchema = projectAssetSchema.extend({
	projectId: uuidSchema,
	projectName: z.string().min(1),
});

export type WorkspaceAsset = z.infer<typeof workspaceAssetSchema>;

export const workspaceAssetsResponseSchema = z.object({
	assets: z.array(workspaceAssetSchema),
	// True when the newest-first list was cut at the server cap; the full
	// history of a single project stays reachable from its own Assets tab.
	truncated: z.boolean(),
});

export type WorkspaceAssetsResponse = z.infer<
	typeof workspaceAssetsResponseSchema
>;

export const projectAssetsRoutes = {
	/** GET — every AI-generated media asset of one owned project, newest first. */
	list: (projectId: string) => `/api/v1/projects/${projectId}/assets`,
	/**
	 * GET — the dashboard Assets page: every asset across every project the
	 * active workspace can see, newest first, capped server-side.
	 */
	listForWorkspace: "/api/v1/assets",
	/**
	 * GET — ownership-checked attachment download. `key` must be one of the
	 * project's own asset keys (the server enforces the prefix).
	 */
	download: (projectId: string, key: string) =>
		`/api/v1/projects/${projectId}/assets/download?key=${encodeURIComponent(key)}`,
} as const;
