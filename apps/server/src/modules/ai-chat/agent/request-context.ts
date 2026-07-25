/**
 * Per-request context block appended to the chat system prompt (V2 spec
 * §5/§6/§10, contract §10): the prompt-box mode settings, the element the
 * user selected in the preview, and the wids they manually edited since the
 * last AI change. Metadata BIASES the model; the user's words always win.
 */
import { videoSubmissionIdSchema } from "@wandit/contracts";
import type { AiChatRequestMetadata } from "../presentation/http/controllers/ai-chat.controller";
import type { AvailableImage } from "./tools/animate-image.tool";

export type ChatRequestContext = {
	manualEdits: string[];
	metadata?: AiChatRequestMetadata;
	// ISO alpha-2 country derived from the request IP at the edge (e.g. "DZ"),
	// or null when no trusted geo header was present.
	requestCountryCode?: string | null;
	// Exact, ownership-checked source selected in the dedicated video picker.
	selectedSourceImage?: AvailableImage;
};

const PAGE_GOALS = ["cod", "leads", "service", "promo"] as const;

type PageGoal = (typeof PAGE_GOALS)[number];

const GOAL_LINES: Record<PageGoal, string> = {
	cod: "  Objectif: Vente COD — the page converts through an Algerian COD order form.",
	leads:
		"  Objectif: Capture de leads — the page converts through a lead form (name + phone).",
	promo:
		"  Objectif: Promo — a promotional offer page pushing one time-limited deal.",
	service:
		"  Objectif: Service — present a service; conversion is contact/booking (WhatsApp, call, form).",
};

const MODE_LINES: Record<string, string> = {
	auto: "- Mode: Auto — infer everything from the message.",
	image:
		"- Mode: Image — the user wants standalone images, generated in the background with generate_image (results appear in the chat and the Assets tab). When the image should feature THEIR product or logo and no usable photo is attached, ask for one first and pass it as a source.",
	marketing:
		"- Mode: Marketing — the user wants a marketing deliverable generated as a named HTML document with generate_marketing_asset (it appears as a card in their Marketing tab). Gather any missing facts first. Do not queue a page build unless they clearly ask for a page.",
	page: "- Mode: Site web — the user wants a website built.",
	video:
		"- Mode: Animer une image — animate the single uploaded source image with animate_image. This is image-to-video, never text-to-video.",
};

const OUTPUT_LINES: Record<string, string> = {
	"ad-copy":
		'  They chose "Ad copy": ready-to-paste ad text variants for one platform, delivered as a named HTML document.',
	"ad-creative":
		'  They chose "Ad creative": a scroll-stopping image composed for a paid ad placement.',
	"creative-brief":
		'  They chose "Creative brief": a brief a designer or videographer could execute without questions, delivered as a named HTML document.',
	"html-asset":
		'  They chose "HTML asset": a custom standalone HTML marketing document (comparison, one-pager, FAQ, offer page…).',
	"image-creator":
		'  They chose "Image creator": free-form standalone image generation.',
	"landing-page":
		'  They chose "Landing page": a single-page conversion funnel (COD-style skeleton when the goal is COD).',
	"marketing-strategy":
		'  They chose "Marketing strategy": a structured, actionable plan, delivered as a named HTML document.',
	"product-shot":
		'  They chose "Product shot": a styled photograph of THEIR product. Build it FROM their real product photo (pass it in sourceImageUrls) — if no product photo is attached yet, ask for one before generating.',
	"site-vitrine":
		'  They chose "Site vitrine": a multi-section presentation site with softer conversion pressure than a COD funnel. Capture the required content and goal; do not prescribe a standard hero/services/about/contact sequence — compose the page flow from the sampled layout moves instead.',
	"video-script":
		'  They chose "Video script": a shot-by-shot short-form ad script (hook, scenes, voiceover, CTA), delivered as a named HTML document.',
};

// Human labels for the generation-settings popover keys. Every setting the
// composer can send MUST surface here or in the mode-specific blocks — an
// option that produces no line is a promise the UI makes and the AI ignores.
const OPTION_LABELS: Record<string, string> = {
	angle: "Angle",
	asset: "Asset kind",
	background: "Background",
	channel: "Channel",
	count: "Number of images",
	depth: "Depth",
	detail: "Detail level",
	duration: "Duration (seconds)",
	format: "Format",
	length: "Copy length",
	platform: "Platform",
	preserve: "Preserve",
	quality: "Image quality",
	scene: "Scene",
	size: "Aspect ratio",
	strategy: "Strategy kind",
	text: "Text on image",
	variants: "Number of variants",
};

// Transport/internal keys, or keys already rendered by a dedicated block.
const HANDLED_OPTION_KEYS = new Set([
	"goal",
	"motion",
	"ratio",
	"sourceImageUrl",
	"sourceMediaType",
	"videoSubmissionId",
]);

/**
 * Render the remaining generation settings generically ("Platform: tiktok.")
 * so a newly added UI option is ALWAYS visible to the model even before it
 * gets bespoke prose.
 */
function formatOptionLines(
	options: Record<string, unknown> | undefined,
): string[] {
	if (!options) {
		return [];
	}

	const lines: string[] = [];

	for (const [key, raw] of Object.entries(options)) {
		if (HANDLED_OPTION_KEYS.has(key)) {
			continue;
		}

		if (typeof raw !== "string" && typeof raw !== "number") {
			continue;
		}

		const value = String(raw);
		const label = OPTION_LABELS[key] ?? key;
		const rendered =
			key === "size" ? (aspectFromSizeToken(value) ?? value) : value;

		lines.push(`  ${label}: ${rendered}.`);
	}

	return lines;
}

// The composer encodes aspect ratios as "9-16" tokens; the model reads "9:16".
function aspectFromSizeToken(value: string): string | null {
	const match = /^(\d+)-(\d+)$/.exec(value);

	if (!match) {
		return null;
	}

	const [, width, height] = match;

	return width && height ? `${width}:${height}` : null;
}

/**
 * Resolves the idempotency seed for image animation. Composer options are
 * intentionally extensible, so only a validated browser UUID in Video mode
 * may replace the final user-message id fallback.
 */
export function resolveVideoRequestKeySeed(
	metadata: AiChatRequestMetadata | undefined,
	fallback: string | undefined,
): string | undefined {
	if (metadata?.composer?.mode !== "video") {
		return fallback;
	}

	const parsed = videoSubmissionIdSchema.safeParse(
		metadata.composer.options?.videoSubmissionId,
	);

	return parsed.success ? parsed.data : fallback;
}

/**
 * Returns the block appended to WANDIT_SYSTEM_PROMPT, or null when nothing
 * applies (no composer metadata, no selection, no manual edits).
 */
export function buildChatRequestContext(
	context: ChatRequestContext,
): string | null {
	const paragraphs: string[] = [];
	const composer = context.metadata?.composer;

	if (composer) {
		const lines = [
			"Prompt-box settings for THIS message — honor them, but the user's words always win over the settings:",
		];
		const modeLine = MODE_LINES[composer.mode];

		if (modeLine) {
			lines.push(modeLine);
		}

		if (composer.mode === "page") {
			// Unknown/retired output ids are treated as absent, never an error.
			const outputLine = composer.output
				? OUTPUT_LINES[composer.output]
				: undefined;

			if (outputLine) {
				lines.push(outputLine);
			}

			const goal = composer.options?.goal;

			if (typeof goal === "string" && isPageGoal(goal)) {
				lines.push(GOAL_LINES[goal]);
			}
		}

		if (composer.mode === "marketing" || composer.mode === "image") {
			const outputLine = composer.output
				? OUTPUT_LINES[composer.output]
				: undefined;

			if (outputLine) {
				lines.push(outputLine);
			}

			lines.push(...formatOptionLines(composer.options));
		}

		if (composer.mode === "video") {
			if (composer.output === "image-animation") {
				lines.push(
					'  Output: "Image animation" — one silent five-second clip.',
				);
			}

			if (context.selectedSourceImage) {
				lines.push(
					"  Dedicated source image for this request — pass these exact " +
						`values to animate_image: URL ${JSON.stringify(
							context.selectedSourceImage.url,
						)}, media type ${context.selectedSourceImage.mediaType}.`,
				);
			}

			const motion = composer.options?.motion;

			if (isVideoMotion(motion)) {
				lines.push(`  Motion strength: ${motion}.`);
			}

			const ratio = composer.options?.ratio;
			const aspect = videoAspectFromRatio(ratio);

			if (aspect) {
				lines.push(`  Required video aspect ratio: ${aspect}.`);
			}
		}

		paragraphs.push(lines.join("\n"));
	}

	const selectedWid = context.metadata?.selectedWid;

	if (selectedWid) {
		paragraphs.push(
			"The user selected an element in the page preview for THIS message: " +
				`data-wid="${selectedWid}". When they say "this", "here", "ça", ` +
				'"هذا" they mean that element. Call get_page_outline / ' +
				"read_section to see it before answering or editing.",
		);
	}

	if (context.requestCountryCode) {
		paragraphs.push(
			"The user's request came from country code " +
				`${context.requestCountryCode.toUpperCase()} (IP-derived, approximate). ` +
				"When they ask to scrape leads without naming a place, default to " +
				"this country. Their words always win over this hint.",
		);
	}

	if (context.manualEdits.length > 0) {
		const edited = context.manualEdits
			.map((wid) =>
				wid === "__tokens__" ? "the global theme (colors/fonts)" : wid,
			)
			.join(", ");

		paragraphs.push(
			"The user manually edited parts of the current page with the visual " +
				`editor since the last AI change: ${edited}. Those edits are ` +
				"intentional. Never overwrite or regenerate those elements — and " +
				"prefer surgical edit tools over full rebuilds while such edits " +
				"exist — unless the user explicitly asks to redo them.",
		);
	}

	if (paragraphs.length === 0) {
		return null;
	}

	return [
		"## This request (set by the app, not the user's words)",
		...paragraphs,
	].join("\n\n");
}

function isPageGoal(goal: string): goal is PageGoal {
	return (PAGE_GOALS as readonly string[]).includes(goal);
}

function isVideoMotion(
	value: unknown,
): value is "subtle" | "balanced" | "dynamic" {
	return value === "subtle" || value === "balanced" || value === "dynamic";
}

function videoAspectFromRatio(value: unknown): "9:16" | "1:1" | "16:9" | null {
	if (value === "9-16") {
		return "9:16";
	}

	if (value === "1-1") {
		return "1:1";
	}

	if (value === "16-9") {
		return "16:9";
	}

	return null;
}
