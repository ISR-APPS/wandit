import { z } from "zod";
import { attachmentMediaTypeSchema } from "./attachments";
import {
	imageGenerationAspectSchema,
	MAX_IMAGES_PER_GENERATION,
} from "./image-generations";
import { marketingAssetTypeSchema } from "./marketing-assets";
import {
	imageToVideoAspectSchema,
	imageToVideoMotionSchema,
	imageToVideoSourceMediaTypeSchema,
} from "./media-generations";
import { widSchema } from "./page-edits";

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
	accept: z.array(z.enum(["image", "document"])).optional(),
	// Optional exact MIME allowlist. This narrows a broad category such as
	// "image" when a workflow only supports still JPEG/PNG/WebP sources.
	// Kept optional so persisted asks from before this field remain valid.
	mediaTypes: z.array(attachmentMediaTypeSchema).min(1).max(7).optional(),
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
 * read_skill — RETIRED. The live agent no longer exposes this tool (the
 * builder carries its design guidance in its own system prompt now), but the
 * schemas must survive so chats that called it still validate and render.
 */
export const skillSlugSchema = z.enum(["landing-page-design"]);

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
 * get_direction_candidates — the Brain samples a bounded random menu of
 * palettes, font pairings, skeletons, layout moves, interactions, motion
 * vocabularies and finishes, then commits to choices from it in the brief.
 */
export const getDirectionCandidatesInputSchema = z.object({
	// Short free-text business descriptor (e.g. "candles", "streetwear"),
	// matched against the library's avoidFor/industries tags.
	business: z.string().min(1),
	// 2-4 lowercase English industry keywords (canonical list lives in the
	// system prompt; matching is fuzzy + accent-folded server-side). Free
	// strings, NOT an enum, on purpose: an enum violation kills the run, while
	// an off-list hint just matches nothing. Optional so old rows stay valid.
	industryHints: z.array(z.string().min(1)).max(4).optional(),
});

export const getDirectionCandidatesOutputSchema = z.object({
	// The formatted candidate menu (formatCandidates() text) the model reads.
	candidates: z.string(),
});

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
});

export const generatePageOutputSchema = z.object({
	// "unavailable" = server missing R2/Trigger credentials; the model relays
	// that honestly instead of pretending a page is coming.
	status: z.enum(["queued", "unavailable"]),
	attemptId: z.string().uuid().optional(),
	versionNumber: z.number().int().positive().optional(),
	// Human-facing note the model can relay verbatim.
	message: z.string(),
});

export type GeneratePageInput = z.infer<typeof generatePageInputSchema>;
export type GeneratePageOutput = z.infer<typeof generatePageOutputSchema>;

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
	// Human-facing note the model can relay verbatim.
	message: z.string(),
});

export type ScrapeLeadsInput = z.infer<typeof scrapeLeadsInputSchema>;
export type ScrapeLeadsOutput = z.infer<typeof scrapeLeadsOutputSchema>;

/**
 * animate_image — queues a five-second image-to-video generation. The source
 * must be an uploaded JPEG/PNG/WebP; this tool never generates video from text
 * alone. The chat card polls the durable media-generation attempt.
 */
export const animateImageInputSchema = z.object({
	sourceImageUrl: z.url(),
	sourceMediaType: imageToVideoSourceMediaTypeSchema,
	aspect: imageToVideoAspectSchema,
	motion: imageToVideoMotionSchema,
	prompt: z.string().min(1).max(2_000),
});

export const animateImageOutputSchema = z.object({
	// "unavailable" means the server is missing video-provider or storage
	// configuration; the model must say so instead of promising a result.
	status: z.enum(["queued", "unavailable"]),
	attemptId: z.string().uuid().optional(),
	message: z.string().min(1),
});

export type AnimateImageInput = z.infer<typeof animateImageInputSchema>;
export type AnimateImageOutput = z.infer<typeof animateImageOutputSchema>;

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
	// Human-facing note the model can relay verbatim.
	message: z.string().min(1),
});

export type GenerateMarketingAssetInput = z.infer<
	typeof generateMarketingAssetInputSchema
>;
export type GenerateMarketingAssetOutput = z.infer<
	typeof generateMarketingAssetOutputSchema
>;

/**
 * generate_image — queues one standalone image generation (1-4 images). Can
 * start from text alone or EDIT user-uploaded source images (product photo,
 * logo) so outputs stay faithful to the real product. Distinct from the
 * builder's in-build image tool.
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
	// faithful to. Each MUST exactly match a user-provided attachment.
	sourceImageUrls: z.array(z.url()).max(3).default([]),
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
	html: z.string().min(20).max(60_000),
});

export const replaceSectionOutputSchema = z.object({
	status: z.enum(["applied", "rejected", "no-page"]),
	versionNumber: z.number().int().positive().optional(),
	message: z.string().min(1),
});

export type ReplaceSectionInput = z.infer<typeof replaceSectionInputSchema>;
export type ReplaceSectionOutput = z.infer<typeof replaceSectionOutputSchema>;

/** Tool map for typing UIMessage on both web and server without sharing runtime code. */
export type AiChatTools = {
	ask_user: { input: AskUserInput; output: AskUserOutput };
	read_skill: { input: ReadSkillInput; output: ReadSkillOutput };
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
	animate_image: { input: AnimateImageInput; output: AnimateImageOutput };
	get_page_outline: {
		input: GetPageOutlineInput;
		output: GetPageOutlineOutput;
	};
	read_section: { input: ReadSectionInput; output: ReadSectionOutput };
	replace_section: {
		input: ReplaceSectionInput;
		output: ReplaceSectionOutput;
	};
};

export const aiChatRoutes = {
	/** POST — AI SDK UI-message stream (useChat endpoint). */
	stream: (chatId: string) => `/api/v1/chats/${chatId}/ai-stream`,
} as const;
