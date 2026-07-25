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
		"- Mode: Image — standalone image generation is not available yet; say so honestly and offer what you CAN do (images are generated inside page builds).",
	marketing:
		"- Mode: Marketing — the user wants a marketing deliverable IN CHAT (copy, plan, script). Do not queue a page build unless they clearly ask for a page.",
	page: "- Mode: Site web — the user wants a website built.",
	video:
		"- Mode: Vidéo — animate the single uploaded source image with animate_image. This is image-to-video, never text-to-video.",
};

const OUTPUT_LINES: Record<string, string> = {
	"landing-page":
		'  They chose "Landing page": a single-page conversion funnel (COD-style skeleton when the goal is COD).',
	"site-vitrine":
		'  They chose "Site vitrine": a multi-section presentation site with softer conversion pressure than a COD funnel. Capture the required content and goal; do not prescribe a standard hero/services/about/contact sequence — compose the page flow from the sampled layout moves instead.',
};

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
