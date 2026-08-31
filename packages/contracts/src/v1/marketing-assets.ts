/**
 * Marketing asset contracts.
 *
 * A marketing asset is one named HTML deliverable (ad copy set, strategy,
 * video script, creative brief, custom HTML doc) generated in the background
 * and shown as a card in the workspace Marketing tab. The chat tool queues
 * the work; the web polls the project list until every card is terminal.
 */
import { z } from "zod";
import { aiErrorDataSchema } from "./ai-errors";
import { mediaGenerationStatusSchema } from "./media-generations";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Values match the composer output ids in prompt-box verbatim — no mapping
// layer between UI, brain, storage, and this contract.
export const MARKETING_ASSET_TYPES = [
	"ad-copy",
	"marketing-strategy",
	"video-script",
	"creative-brief",
	"html-asset",
] as const;

export const marketingAssetTypeSchema = z.enum(MARKETING_ASSET_TYPES);

export type MarketingAssetType = z.infer<typeof marketingAssetTypeSchema>;

// Same lifecycle vocabulary as every durable generation attempt.
export const marketingAssetStatusSchema = mediaGenerationStatusSchema;

export type MarketingAssetStatus = z.infer<typeof marketingAssetStatusSchema>;

// Everything a Marketing tab card needs. The HTML body is fetched separately
// (it can be large) through the html route.
export const marketingAssetSchema = z.object({
	id: uuidSchema,
	name: z.string().min(1),
	assetType: marketingAssetTypeSchema,
	status: marketingAssetStatusSchema,
	error: z.string().nullable(),
	// Normalized failure detail (docs/features/ai-error-normalization-and-observability.md).
	failure: aiErrorDataSchema.nullable().optional(),
	createdAt: isoDateTimeSchema,
	completedAt: isoDateTimeSchema.nullable(),
});

export type MarketingAsset = z.infer<typeof marketingAssetSchema>;

export const marketingAssetsResponseSchema = z.object({
	assets: z.array(marketingAssetSchema),
});

export type MarketingAssetsResponse = z.infer<
	typeof marketingAssetsResponseSchema
>;

// JSON envelope on purpose (same contract as page HTML): the browser renders
// it in a sandboxed iframe srcdoc, never as a navigable text/html response.
export const marketingAssetHtmlResponseSchema = z.object({
	html: z.string(),
});

export type MarketingAssetHtmlResponse = z.infer<
	typeof marketingAssetHtmlResponseSchema
>;

export const marketingAssetsRoutes = {
	/** GET — all marketing asset cards of one owned project, newest first. */
	list: (projectId: string) => `/api/v1/projects/${projectId}/marketing-assets`,
	/** GET — one finished asset's HTML document (JSON envelope). */
	html: (assetId: string) => `/api/v1/marketing-assets/${assetId}/html`,
	/** GET — ownership-checked download of the HTML file. */
	download: (assetId: string) => `/api/v1/marketing-assets/${assetId}/download`,
} as const;
