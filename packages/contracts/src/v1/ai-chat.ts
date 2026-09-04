import { z } from "zod";
import { paymentRequiredDetailsSchema } from "../http/error-codes";
import type { AiErrorData } from "./ai-errors";
import { attachmentMediaTypeSchema } from "./attachments";
import { composerMetadataSchema } from "./chats";
import {
	imageGenerationAspectSchema,
	MAX_IMAGES_PER_GENERATION,
	MAX_SOURCE_IMAGES_PER_GENERATION,
} from "./image-generations";
import { marketingAssetTypeSchema } from "./marketing-assets";
import { aiElementOpSchema, widSchema } from "./page-edits";
import { PAGE_TOKEN_NAMES } from "./page-theme";
import { productSkuSchema } from "./shared/primitives";
import { triggerRealtimeHandleSchema } from "./shared/trigger-realtime";
import { memberCreditLimitDetailsSchema } from "./workspaces";

// AI SDK v7 LanguageModelUsage-compatible fields kept on assistant messages.
// The nested detail names deliberately follow v7: the old top-level
// cachedInputTokens/reasoningTokens fields no longer exist in the SDK.
const aiChatTokenCountSchema = z.number().int().nonnegative();

/**
 * Typed in-stream counterpart of the HTTP 402 response. The AI SDK prefixes
 * the data-part key, so `billing-error` is sent on the wire as
 * `data-billing-error`.
 */
// Discriminated union: the classic out-of-credits 402, plus the org
// member-limit 403 (the pool could pay, the member's monthly cap could not —
// buying credits is not the fix, so it is a distinct code/status).
export const aiChatBillingErrorDataSchema = z.discriminatedUnion("code", [
	z.object({
		code: z.literal("INSUFFICIENT_CREDITS"),
		details: paymentRequiredDetailsSchema,
		statusCode: z.literal(402),
	}),
	z.object({
		code: z.literal("MEMBER_CREDIT_LIMIT_REACHED"),
		details: memberCreditLimitDetailsSchema,
		statusCode: z.literal(403),
	}),
]);

export type AiChatBillingErrorData = z.infer<
	typeof aiChatBillingErrorDataSchema
>;

/**
 * Sent ONCE per turn, after the metering settle transaction has committed
 * (wire key `data-credits-settled`). Clients move the visible balance from
 * `settledBalance` and then refetch; no reserve/give-back is ever shown.
 */
export const aiChatCreditsSettledDataSchema = z.object({
	usageEventId: z.string(),
	// Decimal credits charged for this turn (positive number).
	credits: z.number().nonnegative(),
	// Decimal credits, post-settle settled balance (same rule as
	// creditBalanceResponseSchema.settledBalance).
	settledBalance: z.number(),
});

export type AiChatCreditsSettledData = z.infer<
	typeof aiChatCreditsSettledDataSchema
>;

export type AiChatDataParts = {
	"ai-error": AiErrorData;
	"billing-error": AiChatBillingErrorData;
	"credits-settled": AiChatCreditsSettledData;
};

export const aiChatMessageUsageSchema = z.object({
	inputTokens: aiChatTokenCountSchema.optional(),
	inputTokenDetails: z
		.object({
			noCacheTokens: aiChatTokenCountSchema.optional(),
			cacheReadTokens: aiChatTokenCountSchema.optional(),
			cacheWriteTokens: aiChatTokenCountSchema.optional(),
		})
		.optional(),
	outputTokens: aiChatTokenCountSchema.optional(),
	outputTokenDetails: z
		.object({
			textTokens: aiChatTokenCountSchema.optional(),
			reasoningTokens: aiChatTokenCountSchema.optional(),
		})
		.optional(),
	totalTokens: aiChatTokenCountSchema.optional(),
});

/** Human-readable snapshot of the preview target attached to one user turn. */
export const aiChatSelectedTargetSchema = z.object({
	wid: widSchema,
	tag: z.string().min(1).max(32),
	excerpt: z.string().max(160).nullable(),
});

export const aiChatMessageMetadataSchema = z.object({
	model: z.string().min(1).optional(),
	usage: aiChatMessageUsageSchema.optional(),
	stepCount: z.number().int().nonnegative().optional(),
	lastStepUsage: aiChatMessageUsageSchema.optional(),
	// Keep the request context on the user row so regenerate can faithfully
	// replay the turn after a browser refresh or native app restart.
	composer: composerMetadataSchema.optional(),
	selectedWids: z.array(widSchema).min(1).max(10).optional(),
	// Provider outcome of the turn, kept on `finish` for the admin inspector.
	finishReason: z.string().optional(),
	rawFinishReason: z.string().optional(),
	provider: z.string().optional(),
	gatewayGenerationId: z.string().optional(),
	selectedTarget: aiChatSelectedTargetSchema.optional(),
	selectedTargets: z
		.array(aiChatSelectedTargetSchema)
		.min(1)
		.max(10)
		.optional(),
});

/** Per-request composer settings and preview targets for the current turn. */
export const aiChatRequestMetadataSchema = z.object({
	composer: composerMetadataSchema.optional(),
	selectedWid: widSchema.optional(),
	selectedWids: z.array(widSchema).min(1).max(10).optional(),
});

export type AiChatSelectedTarget = z.infer<typeof aiChatSelectedTargetSchema>;
export type AiChatMessageUsage = z.infer<typeof aiChatMessageUsageSchema>;
export type AiChatMessageMetadata = z.infer<typeof aiChatMessageMetadataSchema>;
export type AiChatRequestMetadata = z.infer<typeof aiChatRequestMetadataSchema>;

/**
 * ask_user — the assistant asks ONE focused question, answered in the
 * composer tray. The user's answer comes back as the tool output.
 *
 * Backward compatibility matters here: old chats persisted parts with the
 * original narrow shapes ({question, 2-4 options} in / {selectedId, label}
 * out), and validateUIMessages re-runs these schemas on every history load.
 * So the schemas below only RELAX — nothing an old row relied on became
 * required or stricter.
 */
export const askUserOptionSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	// Design-world taste cards: when set, the option refers to a world from the
	// most recent get_direction_candidates result, and the tray renders it as a
	// specimen card (real font + real colors from that result's cards data)
	// instead of a text chip. Optional so every pre-cards row stays valid, and
	// unknown ids simply fall back to the chip rendering.
	worldId: z.string().min(1).optional(),
});

// How the tray should render the question. Optional on input so old
// persisted rows (which predate the field) stay valid.
export const askUserKindSchema = z.enum([
	"single-choice",
	"multi-select",
	"free-text",
	"attachments",
]);

export const askUserInputSchema = z.object({
	question: z.string().min(1),
	// Relaxed from .min(2): free-text asks carry no options. Schema default []
	// (NOT .min()) — hard lesson: min() on tool inputs kills runs when the
	// model asks an open question.
	options: z.array(askUserOptionSchema).max(6).default([]),
	// Optional so old persisted inputs stay valid; UI derives when absent:
	// 0 options → free-text, otherwise single-choice.
	kind: askUserKindSchema.optional(),
	// Quiet helper line rendered under the question.
	helper: z.string().optional(),
	// Legacy flag, kept so old rows still parse.
	allowFreeform: z.boolean().optional(),
	// kind "attachments" only — what the drop tray should accept (default
	// ["image"]) and how many files at most (default 3). Optional so every
	// pre-attachments row stays valid (spec §11 / contract §10.5).
	accept: z.array(z.enum(["image", "document", "video", "audio"])).optional(),
	// Optional exact MIME allowlist. This narrows a broad category such as
	// "image" when a workflow only supports still JPEG/PNG/WebP sources.
	// Kept optional so persisted asks from before this field remain valid.
	mediaTypes: z.array(attachmentMediaTypeSchema).min(1).max(10).optional(),
	maxFiles: z.number().int().min(1).max(6).optional(),
});

// Old rows have {selectedId, label} — every field optional keeps them valid.
// Exactly one "answer shape" is set per response; the model reads whichever
// is present.
export const askUserOutputSchema = z.object({
	selectedId: z.string().min(1).optional(), // single-choice (legacy + new)
	label: z.string().min(1).optional(), // single-choice (legacy + new)
	selections: z.array(askUserOptionSchema).optional(), // multi-select picks
	text: z.string().optional(), // free-text answer (or typed-over answer)
	delegated: z.boolean().optional(), // "Decide for me" escape hatch
	dismissed: z.boolean().optional(), // tray X — treat as "skip, continue"
	// kind "attachments" — uploaded R2 assets the user provided. The model
	// reads the URLs and writes them into the brief's assets section.
	files: z
		.array(
			z.object({
				url: z.url(),
				mediaType: z.string().min(1),
				filename: z.string().optional(),
			}),
		)
		.optional(),
});

export type AskUserOption = z.infer<typeof askUserOptionSchema>;
export type AskUserKind = z.infer<typeof askUserKindSchema>;
export type AskUserInput = z.infer<typeof askUserInputSchema>;
export type AskUserOutput = z.infer<typeof askUserOutputSchema>;

/**
 * read_skill — progressive disclosure for the brain's playbooks.
 *
 * The six `ads-*` slugs are the live ads skills (the composer chips use the
 * same ids). `landing-page-design` is RETIRED (the builder carries its design
 * guidance itself) but stays in the enum so chats that called it still
 * validate and render. Never rename a slug: it is persisted in chat history.
 */
export const skillSlugSchema = z.enum([
	"landing-page-design",
	"ads-fundamentals",
	"ads-creative",
	"ads-audiences",
	"ads-measurement",
	"ads-cod-maghreb",
	"ads-diagnostic",
]);

export const readSkillInputSchema = z.object({
	skill: skillSlugSchema,
});

export const readSkillOutputSchema = z.object({
	skill: skillSlugSchema,
	markdown: z.string(),
});

export type SkillSlug = z.infer<typeof skillSlugSchema>;
export type ReadSkillInput = z.infer<typeof readSkillInputSchema>;
export type ReadSkillOutput = z.infer<typeof readSkillOutputSchema>;

/**
 * read_attachment — the text content of a document the user attached (PDF,
 * Word, Excel, CSV, plain text), extracted server-side on demand. The url
 * must be the exact one carried by the attachment marker; anything else is
 * refused, so the model can never point the server at an invented URL.
 */
export const readAttachmentInputSchema = z.object({ url: z.url() }).strict();

export const readAttachmentOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		filename: z.string().min(1).optional(),
		mediaType: z.string().min(1),
		text: z.string(),
		// True when the document was longer than the extraction budget.
		truncated: z.boolean(),
	}),
	z.object({
		// "unavailable" = not an attachment of this conversation, storage could
		// not serve it, or the document could not be parsed; the model relays
		// that honestly instead of inventing the contents.
		status: z.literal("unavailable"),
		message: z.string().min(1),
	}),
]);

export type ReadAttachmentInput = z.infer<typeof readAttachmentInputSchema>;
export type ReadAttachmentOutput = z.infer<typeof readAttachmentOutputSchema>;

/**
 * read_lead_performance — the merchant's own lead funnel for the chat's
 * project (the Leads tab, the backend truth for COD): counts and rates over
 * the last N days, grouped by source, campaign, or status. Read-only; the
 * input stays tiny on purpose so the model cannot misuse it.
 */
export const readLeadPerformanceWindowDays = [7, 14, 30, 90] as const;
export const readLeadPerformanceGroupBys = [
	"source",
	"campaign",
	"status",
	"none",
] as const;

export const readLeadPerformanceInputSchema = z
	.object({
		// Window: N full Africa/Algiers days before today, plus today so far
		// (from Algiers midnight N days ago to now).
		days: z
			.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90)])
			.optional(),
		// source = facebook | tiktok | direct (derived from click ids and
		// utm_source); campaign = utm_campaign; status = lead status; none =
		// totals only.
		groupBy: z.enum(readLeadPerformanceGroupBys).optional(),
	})
	.strict();

const leadFunnelCountsSchema = z.object({
	total: z.number().int().nonnegative(),
	to_confirm: z.number().int().nonnegative(),
	confirmed: z.number().int().nonnegative(),
	shipped: z.number().int().nonnegative(),
	delivered: z.number().int().nonnegative(),
	returned: z.number().int().nonnegative(),
	cancelled: z.number().int().nonnegative(),
});

export const readLeadPerformanceOutputSchema = z.object({
	// N as requested: N full Africa/Algiers days before today, plus today so far.
	windowDays: z.number().int().positive(),
	// ISO timestamps of the window bounds (from = Algiers midnight N days ago).
	from: z.string(),
	to: z.string(),
	totals: leadFunnelCountsSchema.extend({
		// (confirmed + shipped + delivered + returned) / total — the share of
		// all leads in the window that were confirmed (to_confirm still counts
		// in the denominator). null when total is 0.
		confirmationRate: z.number().min(0).max(1).nullable(),
		// delivered / (shipped + delivered + returned). null when nothing was
		// shipped.
		deliveryRate: z.number().min(0).max(1).nullable(),
		// returned / (shipped + delivered + returned). null when nothing was
		// shipped.
		returnRate: z.number().min(0).max(1).nullable(),
	}),
	// At most 50 groups, ordered by total desc. Empty when groupBy is "none".
	groups: z.array(leadFunnelCountsSchema.extend({ key: z.string() })),
	// Plain-language caveats: scope, exclusions, and the rate definitions.
	note: z.string(),
});

export type ReadLeadPerformanceInput = z.infer<
	typeof readLeadPerformanceInputSchema
>;
export type ReadLeadPerformanceOutput = z.infer<
	typeof readLeadPerformanceOutputSchema
>;
export type LeadFunnelCounts = z.infer<typeof leadFunnelCountsSchema>;

/**
 * get_direction_candidates — the Brain samples a bounded random menu of
 * palettes, font pairings, skeletons, layout moves, interactions, motion
 * vocabularies and finishes, then commits to choices from it in the brief.
 */
export const getDirectionCandidatesInputSchema = z.object({
	// Short free-text business descriptor (e.g. "candles", "streetwear"),
	// matched against the library's avoidFor/industries tags.
	business: z.string().min(1),
	// Optional build genre. Omitted by legacy rows and callers, which keeps the
	// original website + product-dossier menu behavior.
	pageKind: z.enum(["website", "product", "cod"]).optional(),
	// 2-4 lowercase English industry keywords (canonical list lives in the
	// system prompt; matching is fuzzy + accent-folded server-side). Free
	// strings, NOT an enum, on purpose: an enum violation kills the run, while
	// an off-list hint just matches nothing. Optional so old rows stay valid.
	industryHints: z.array(z.string().min(1)).max(4).optional(),
});

/**
 * A design world's card face for the taste question: the world's real skin
 * (ground/ink/accent + display face + specimen word) plus its user-facing
 * name and tagline. Server-authored from the world registry — the full doc
 * never leaves the backend. The tray renders these as tappable specimen
 * cards when an ask_user option carries a matching worldId.
 */
export const worldCardSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	tagline: z.string().min(1),
	preview: z.object({
		ground: z.string().min(1),
		ink: z.string().min(1),
		accent: z.string().min(1),
		fontFamily: z.string().min(1),
		sampleWord: z.string().min(1),
	}),
});

export const getDirectionCandidatesOutputSchema = z.object({
	// The formatted candidate menu (formatCandidates() text) the model reads.
	candidates: z.string(),
	// Card faces for every sampled world that ships a preview, keyed by the
	// same ids as the menu text. Optional so historical menus stay valid.
	cards: z.array(worldCardSchema).optional(),
});

export type WorldCard = z.infer<typeof worldCardSchema>;
export type GetDirectionCandidatesInput = z.infer<
	typeof getDirectionCandidatesInputSchema
>;
export type GetDirectionCandidatesOutput = z.infer<
	typeof getDirectionCandidatesOutputSchema
>;

/**
 * generate_page — the Brain queues a background page build with one complete
 * creative brief (facts + the art direction the Brain committed to from the
 * sampled candidates). The tool answers immediately; the finished page lands
 * in the Page tab.
 */
export const generatePageInputSchema = z.object({
	// Short human title for the page (used for version labels).
	title: z.string().min(1).max(120),
	// The complete creative brief the Brain composed from the conversation:
	// business, audience, language, assets, required content, offer/price,
	// conversion details, constraints, and the committed art direction.
	// Free text on purpose — the builder prompt defines the section format.
	brief: z.string().min(50),
	// Id of the DESIGN WORLD the Brain chose from get_direction_candidates.
	// The server appends that world's full design bible to the builder's
	// system prompt snapshot. Free string (not an enum) so an off-list id
	// degrades to a world-less build instead of killing the run.
	worldId: z.string().min(1).optional(),
	// Ordered design-world ids for COD fusion: base first, then donors. When
	// present this wins over the legacy single worldId field.
	worldIds: z.array(z.string().min(1)).min(1).max(4).optional(),
	// Durable page classification. Optional so historical tool calls continue
	// to validate unchanged.
	pageKind: z.enum(["website", "cod"]).optional(),
	// COD page type. "simple" = the clean few-block funnel built WITHOUT
	// design worlds (a server-sampled recipe owns the skin); "max" = the full
	// world-driven funnel. Optional so historical calls stay valid; when
	// absent on a COD build the server infers "max" when worldIds ride along
	// and "simple" otherwise.
	codMode: z.enum(["simple", "max"]).optional(),
	// Merchant-provided identifier snapshotted onto COD page versions. Optional
	// here so historical tool calls and queued attempts keep parsing.
	productSku: productSkuSchema.optional(),
});

// Definition moved to shared/trigger-realtime.ts (leaf module) so pages.ts
// can use it without closing an ESM import cycle; re-exported here to keep
// every existing "@wandit/contracts" consumer working unchanged.
export {
	type TriggerRealtimeHandle,
	triggerRealtimeHandleSchema,
} from "./shared/trigger-realtime";

export const generatePageOutputSchema = z.object({
	// "unavailable" = server missing R2/Trigger credentials; the model relays
	// that honestly instead of pretending a page is coming.
	// "needs-input" = the request is valid but missing user-owned information;
	// the model follows the message, collects it, and then retries the tool.
	status: z.enum(["queued", "unavailable", "needs-input"]),
	attemptId: z.string().uuid().optional(),
	versionNumber: z.number().int().positive().optional(),
	// Resolved gateway model snapshotted onto the queued attempt. Optional for
	// historical and non-queued outputs.
	builderModel: z.string().min(1).optional(),
	realtime: triggerRealtimeHandleSchema.optional(),
	// Human-facing note the model can relay verbatim.
	message: z.string(),
});

export type GeneratePageInput = z.infer<typeof generatePageInputSchema>;
export type GeneratePageOutput = z.infer<typeof generatePageOutputSchema>;

/**
 * Live build progress the page-build worker pushes over Trigger Realtime
 * (metadata key "progress"). The chat card folds it into a checklist: art
 * generated (with hosted thumbnails), page written (with section chips),
 * screenshot review passes (with shot thumbnails), fixes applied, handover.
 *
 * Wire-tolerant BY CONSTRUCTION: every field carries a .catch() default, so
 * one bad or missing field (an older worker, a future field change, a
 * malformed URL) degrades that field alone — it must never blank the whole
 * card mid-build.
 */
export const pageBuildShotSchema = z.object({
	// Plain string, not z.url(): a misconfigured public base yields relative
	// paths, and rejecting them here would discard the entire snapshot.
	url: z.string(),
	viewport: z.enum(["desktop", "mobile"]),
});

export const pageBuildPhaseSchema = z.enum([
	"starting",
	"art",
	"writing",
	"reviewing",
	"fixing",
	"finishing",
]);

export type PageBuildPhase = z.infer<typeof pageBuildPhaseSchema>;

export const pageBuildProgressSchema = z.object({
	// 0-100, monotonically non-decreasing (the tracker clamps regressions).
	percent: z.number().min(0).max(100).catch(2),
	// Which checklist row is currently alive. Phases can recur (review →
	// fix → review) — the card re-activates the matching row in place.
	phase: pageBuildPhaseSchema.catch("starting"),
	// One short present-tense line for the card header, e.g. "Writing the
	// page…". English chrome, same rule as the tray strings.
	headline: z.string().min(1).catch("Working on the page…"),
	// Hosted URLs of successfully generated build images, in order.
	images: z
		.array(z.object({ role: z.string(), url: z.string() }))
		.max(12)
		.catch([]),
	// Section labels parsed from the latest index.html write (aria-label, id,
	// or first heading per top-level <section>; h2 fallback).
	sections: z.array(z.string()).max(12).catch([]),
	pageBytes: z.number().int().min(0).catch(0),
	// Successful screenshot review passes so far / required per build.
	reviewPasses: z.number().int().min(0).catch(0),
	reviewTarget: z.number().int().min(1).catch(2),
	// The pass currently being captured or reviewed (1-based) — what the
	// card's "pass X of Y" badge shows while the review row is active.
	currentPass: z.number().int().min(1).optional().catch(undefined),
	// Hosted thumbnails from the LATEST screenshot pass only.
	shots: z.array(pageBuildShotSchema).max(8).catch([]),
	// Human-readable diagnostics from the latest pass (console errors,
	// failed requests, overflow) — empty when the render came back clean.
	findings: z.array(z.string()).max(6).catch([]),
	// edit_file fixes applied after the first review pass.
	fixes: z.number().int().min(0).catch(0),
	// finish accepted — the page is being published.
	done: z.boolean().catch(false),
});

export type PageBuildShot = z.infer<typeof pageBuildShotSchema>;
export type PageBuildProgress = z.infer<typeof pageBuildProgressSchema>;

/**
 * scrape_leads — the Brain queues a background prospect scrape: find real
 * businesses (name/phone/email/website/address) matching a niche + location
 * and export them to a downloadable .xlsx. Like generate_page, the tool
 * answers immediately with "queued"; the chat card polls the attempt endpoint
 * (v1/lead-scrapes.ts) for live progress and the finished workbook.
 */
export const scrapeLeadsInputSchema = z.object({
	// The business niche to hunt for, e.g. "gyms", "cabinets dentaires".
	query: z.string().min(1).max(200),
	// City/region to search, e.g. "Alger" or "Oran, Algérie". Optional so the
	// server can fall back to the user's IP-derived country when omitted.
	location: z.string().min(1).max(200).optional(),
	// ISO 3166-1 alpha-2 country of that location (e.g. "dz"). Critical for
	// ambiguous city names — "Algiers" alone geocodes to Algiers, Louisiana.
	// Falls back to the request's IP-derived country when omitted.
	country: z.string().length(2).optional(),
	// How many businesses to collect at most; the server clamps to its cap.
	limit: z.number().int().min(5).max(200).optional(),
});

export const scrapeLeadsOutputSchema = z.object({
	// "unavailable" = server missing the provider/R2/Trigger credentials; the
	// model relays that honestly instead of pretending a scrape is running.
	status: z.enum(["queued", "unavailable"]),
	attemptId: z.string().uuid().optional(),
	realtime: triggerRealtimeHandleSchema.optional(),
	// Human-facing note the model can relay verbatim.
	message: z.string(),
});

export type ScrapeLeadsInput = z.infer<typeof scrapeLeadsInputSchema>;
export type ScrapeLeadsOutput = z.infer<typeof scrapeLeadsOutputSchema>;

/**
 * generate_marketing_asset — the Brain queues one named marketing deliverable
 * (HTML document) built from a complete marketing brief. The tool answers
 * immediately; the finished card appears in the Marketing tab.
 */
export const generateMarketingAssetInputSchema = z.object({
	// Display name for the Marketing tab card, in the user's language
	// (e.g. "Ads Meta — Lancement PulseBuds").
	title: z.string().min(1).max(120),
	assetType: marketingAssetTypeSchema,
	// The complete marketing brief composed from the conversation: business,
	// audience, offer, platform, angle, tone, language, count of variants,
	// every real fact the copy may use. The generator sees ONLY this.
	brief: z.string().min(30),
});

export const generateMarketingAssetOutputSchema = z.object({
	// "unavailable" = server missing R2/Trigger credentials or the request was
	// rejected; the model relays that honestly.
	status: z.enum(["queued", "unavailable"]),
	assetId: z.string().uuid().optional(),
	realtime: triggerRealtimeHandleSchema.optional(),
	// Human-facing note the model can relay verbatim.
	message: z.string().min(1),
});

export type GenerateMarketingAssetInput = z.infer<
	typeof generateMarketingAssetInputSchema
>;
export type GenerateMarketingAssetOutput = z.infer<
	typeof generateMarketingAssetOutputSchema
>;

export const generateImagePlacementSchema = z.object({
	kind: z.literal("image-src"),
	wid: widSchema,
	imageIndex: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION).default(1),
});

export type GenerateImagePlacement = z.infer<
	typeof generateImagePlacementSchema
>;

/**
 * generate_image — queues one image generation (1-6 separate images). Can start from
 * text alone or EDIT user-uploaded source images (product photo, logo) so
 * outputs stay faithful to the real product. A bounded optional placement
 * replaces one existing page image when generation finishes. Distinct from
 * the builder's in-build image tool.
 */
export const generateImageInputSchema = z.object({
	// Display name for the chat card and the Assets tab, in the user's
	// language (e.g. "Photo produit — fond studio").
	title: z.string().min(1).max(120),
	// Full image prompt following the house conventions (medium, subject,
	// setting, lighting, mood, composition, color anchors, "No text...").
	prompt: z.string().min(10).max(4_000),
	aspect: imageGenerationAspectSchema,
	count: z.number().int().min(1).max(MAX_IMAGES_PER_GENERATION).default(1),
	// URLs of images the user attached in this conversation to edit or stay
	// faithful to. Each MUST exactly match a user-provided attachment. No zod
	// maximum on purpose: the tool keeps the first
	// MAX_SOURCE_IMAGES_PER_GENERATION and reports the rest, so a long list
	// degrades gracefully instead of failing tool-input validation.
	sourceImageUrls: z
		.array(z.url())
		.default([])
		.describe(
			"Exact URLs of images the user attached in this conversation, at " +
				`most ${MAX_SOURCE_IMAGES_PER_GENERATION}. Only the first ` +
				`${MAX_SOURCE_IMAGES_PER_GENERATION} are used; extras are skipped ` +
				"and reported back.",
		),
	placement: generateImagePlacementSchema.optional(),
});

export const generateImageOutputSchema = z.object({
	// "unavailable" means missing provider/storage config or an ineligible
	// source image; the model must say so instead of promising a result.
	status: z.enum(["queued", "unavailable"]),
	attemptId: z.string().uuid().optional(),
	message: z.string().min(1),
});

export type GenerateImageInput = z.infer<typeof generateImageInputSchema>;
export type GenerateImageOutput = z.infer<typeof generateImageOutputSchema>;

/** apply_element_ops — a bounded batch of targeted, AI-safe page mutations. */
export const applyElementOpsInputSchema = z.object({
	ops: z
		.array(aiElementOpSchema)
		.min(1)
		.max(20)
		.describe("1 to 20 ops. Never send an empty list."),
});

export const applyElementOpsOutputSchema = z.object({
	status: z.enum(["applied", "rejected", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	message: z.string().min(1),
});

export type ApplyElementOpsInput = z.infer<typeof applyElementOpsInputSchema>;
export type ApplyElementOpsOutput = z.infer<typeof applyElementOpsOutputSchema>;

/** read_elements — current stamped HTML for up to ten exact data-wids. */
export const readElementsInputSchema = z.object({
	wids: z.array(widSchema).min(1).max(10),
});

const readElementResultSchema = z.object({
	wid: widSchema,
	found: z.boolean(),
	html: z.string().optional(),
});

export const readElementsOutputSchema = z.object({
	status: z.enum(["ok", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	elements: z.array(readElementResultSchema).max(10).optional(),
	message: z.string().optional(),
});

export type ReadElementsInput = z.infer<typeof readElementsInputSchema>;
export type ReadElementsOutput = z.infer<typeof readElementsOutputSchema>;

/** read_theme — current values from the first reserved :root token block. */
export const readThemeInputSchema = z.object({});

export const readThemeOutputSchema = z.object({
	status: z.enum(["ok", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	tokens: z.partialRecord(z.enum(PAGE_TOKEN_NAMES), z.string()).optional(),
	message: z.string().optional(),
});

export type ReadThemeInput = z.infer<typeof readThemeInputSchema>;
export type ReadThemeOutput = z.infer<typeof readThemeOutputSchema>;

/** get_page_outline — cheap section map of the active version (spec §5). */
export const getPageOutlineInputSchema = z.object({});

export const pageOutlineSectionSchema = z.object({
	wid: widSchema,
	tag: z.string().min(1),
	snippet: z.string(),
	elements: z.number().int().nonnegative(),
});

export const getPageOutlineOutputSchema = z.object({
	status: z.enum(["ok", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	sections: z.array(pageOutlineSectionSchema).optional(),
	message: z.string().optional(),
});

export type GetPageOutlineInput = z.infer<typeof getPageOutlineInputSchema>;
export type GetPageOutlineOutput = z.infer<typeof getPageOutlineOutputSchema>;

/** read_section — one section's stamped HTML. */
export const readSectionInputSchema = z.object({ wid: widSchema });

export const readSectionOutputSchema = z.object({
	status: z.enum(["ok", "not-found", "no-page"]),
	wid: widSchema,
	html: z.string().optional(),
	message: z.string().optional(),
});

export type ReadSectionInput = z.infer<typeof readSectionInputSchema>;
export type ReadSectionOutput = z.infer<typeof readSectionOutputSchema>;

/** replace_section — DOM surgery producing a NEW immutable version. */
export const replaceSectionInputSchema = z.object({
	wid: widSchema,
	html: z
		.string()
		.min(20)
		.max(60_000)
		.describe("Section HTML only; never JavaScript or scripts."),
});

export const replaceSectionOutputSchema = z.object({
	status: z.enum(["applied", "rejected", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	message: z.string().min(1),
});

export type ReplaceSectionInput = z.infer<typeof replaceSectionInputSchema>;
export type ReplaceSectionOutput = z.infer<typeof replaceSectionOutputSchema>;

/** insert_section — inserts one section relative to an existing section. */
export const insertSectionInputSchema = z.object({
	anchorWid: widSchema,
	position: z.enum(["before", "after"]).default("after"),
	html: z.string().min(20).max(60_000),
});

export const insertSectionOutputSchema = z.object({
	status: z.enum(["applied", "rejected", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	message: z.string().min(1),
});

export type InsertSectionInput = z.infer<typeof insertSectionInputSchema>;
export type InsertSectionOutput = z.infer<typeof insertSectionOutputSchema>;

/** Tool map for typing UIMessage on both web and server without sharing runtime code. */
export type AiChatTools = {
	ask_user: { input: AskUserInput; output: AskUserOutput };
	read_skill: { input: ReadSkillInput; output: ReadSkillOutput };
	read_attachment: {
		input: ReadAttachmentInput;
		output: ReadAttachmentOutput;
	};
	read_lead_performance: {
		input: ReadLeadPerformanceInput;
		output: ReadLeadPerformanceOutput;
	};
	get_direction_candidates: {
		input: GetDirectionCandidatesInput;
		output: GetDirectionCandidatesOutput;
	};
	generate_page: { input: GeneratePageInput; output: GeneratePageOutput };
	generate_marketing_asset: {
		input: GenerateMarketingAssetInput;
		output: GenerateMarketingAssetOutput;
	};
	generate_image: { input: GenerateImageInput; output: GenerateImageOutput };
	scrape_leads: { input: ScrapeLeadsInput; output: ScrapeLeadsOutput };
	get_page_outline: {
		input: GetPageOutlineInput;
		output: GetPageOutlineOutput;
	};
	apply_element_ops: {
		input: ApplyElementOpsInput;
		output: ApplyElementOpsOutput;
	};
	read_elements: { input: ReadElementsInput; output: ReadElementsOutput };
	read_theme: { input: ReadThemeInput; output: ReadThemeOutput };
	read_section: { input: ReadSectionInput; output: ReadSectionOutput };
	replace_section: {
		input: ReplaceSectionInput;
		output: ReplaceSectionOutput;
	};
	insert_section: {
		input: InsertSectionInput;
		output: InsertSectionOutput;
	};
};

export const aiChatRoutes = {
	/** POST — AI SDK UI-message stream (useChat endpoint). */
	stream: (chatId: string) => `/api/v1/chats/${chatId}/ai-stream`,
} as const;
