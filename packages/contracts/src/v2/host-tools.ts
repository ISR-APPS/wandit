/**
 * Wire contract for the host tools the builder-turn task hands to the
 * harness. The AI SDK parses each tool call with the input schema; the
 * output schema types the result the tool returns. The sandbox never
 * sees them.
 */
import { z } from "zod";

import { type AskUserKind, askUserKindSchema } from "../v1/ai-chat";

// The literal list mirrors `BUILD_IMAGE_ASPECTS` in the V1 site builder
// (apps/server/src/modules/ai-chat/agent/site-builder/generate-image.ts):
// gpt-image-class models accept exact sizes, not free aspect ratios.
const hostImageAspects = ["1:1", "2:3", "3:2", "4:5", "16:9"] as const;

/**
 * Input of the `generate_image` host tool. `path` stays a plain string
 * here; the tool validates the prefix rules before it reserves credits.
 */
export const generateImageHostToolInputSchema = z.object({
	prompt: z.string().min(1).max(2000),
	aspect: z.enum(hostImageAspects),
	// Project-relative image target; the tool rejects `..` and absolute paths.
	path: z.string().min(1),
	// User photo URLs to edit instead of a text-only generation. The edit
	// model takes at most 4 sources.
	sourceImageUrls: z.array(z.url()).max(4).optional(),
});

/** Parsed `generate_image` input; the tool execute body reads this shape. */
export type GenerateImageHostToolInput = z.infer<
	typeof generateImageHostToolInputSchema
>;

/**
 * Output of the `generate_image` host tool. `path` is the final
 * project-relative file the task wrote into the sandbox; it can differ
 * from the requested path when the extension did not match the media type.
 */
export const generateImageHostToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("generated"),
			url: z.string(),
			width: z.number().int().nonnegative(),
			height: z.number().int().nonnegative(),
			path: z.string(),
		}),
		z.object({
			status: z.literal("failed"),
			message: z.string(),
		}),
		z.object({
			status: z.literal("unavailable"),
			message: z.string(),
		}),
	],
);

/** Parsed `generate_image` output; the union of the three statuses. */
export type GenerateImageHostToolOutput = z.infer<
	typeof generateImageHostToolOutputSchema
>;

/**
 * Input of the `request_network_host` host tool (WANDIT-180). The agent
 * asks to reach one extra egress host; the user approves the call first.
 * The tool re-checks `host` before it changes any policy.
 */
export const requestNetworkHostToolInputSchema = z.object({
	// The DNS host to allow, for example `api.github.com` or `*.plausible.io`.
	// RFC 1035 caps a host name at 253 chars.
	host: z.string().min(1).max(253),
	// One short line the approval card shows to the user.
	reason: z.string().min(1).max(500),
});

/** Parsed `request_network_host` input; the tool execute body reads this. */
export type RequestNetworkHostToolInput = z.infer<
	typeof requestNetworkHostToolInputSchema
>;

/**
 * Output of the `request_network_host` host tool. `allowed` means the
 * sandbox now reaches `host`; `denied` carries the reason the tool
 * refused, for example an invalid host or a failed policy update.
 */
export const requestNetworkHostToolOutputSchema = z.discriminatedUnion(
	"status",
	[
		z.object({
			status: z.literal("allowed"),
			host: z.string(),
		}),
		z.object({
			status: z.literal("denied"),
			reason: z.string(),
		}),
	],
);

/** Parsed `request_network_host` output; the allowed/denied union. */
export type RequestNetworkHostToolOutput = z.infer<
	typeof requestNetworkHostToolOutputSchema
>;

/**
 * Input of the `set_theme` host tool (web-app@1.1.0+ or desktop-app@1.0.0+). Every field is an
 * optional string, so a wrong value never fails the call: the tool parses
 * each one with tolerance (case, spaces) and answers the allowed values.
 * Only the named fields change; `src/styles/theme.json` holds the rest.
 */
export const setThemeHostToolInputSchema = z.object({
	// A business category, for example "medical". Deals a whole new theme.
	business: z.string().optional(),
	// A look id or name, for example "pop-pastel".
	look: z.string().optional(),
	// A design world id, for example "zellige": its palette and fonts.
	world: z.string().optional(),
	// True deals another look than the current one.
	reroll: z.boolean().optional(),
	mode: z.string().optional(),
	// "look", a hue such as "violet", or a "#rrggbb" brand color.
	primary: z.string().optional(),
	// With `foreground` and a hex `primary`: three brand seed colors.
	background: z.string().optional(),
	foreground: z.string().optional(),
	font: z.string().optional(),
	displayFont: z.string().optional(),
	scale: z.string().optional(),
	radius: z.string().optional(),
	// A width in px, for example "1.5". A number is accepted too.
	border: z.union([z.string(), z.number()]).optional(),
	shadow: z.string().optional(),
	shadowStyle: z.string().optional(),
	content: z.string().optional(),
	sidebarStyle: z.string().optional(),
	sidebarCollapse: z.string().optional(),
	sidebarStart: z.string().optional(),
	sidebarTone: z.string().optional(),
	activeItem: z.string().optional(),
	header: z.string().optional(),
	userMenu: z.string().optional(),
	frame: z.string().optional(),
	icons: z.string().optional(),
	// The frame of the nav icons, for example "color" for one hue tile per item.
	navIcon: z.string().optional(),
});

/** Parsed `set_theme` input; the tool parses each value against the theme options. */
export type SetThemeHostToolInput = z.infer<typeof setThemeHostToolInputSchema>;

/**
 * One option of an `ask_user` question. `worldId` names a design world
 * skill; the task then adds the preview card of that world to the question.
 * No length limits here: Claude Code does not enforce them, and a failed
 * parse would fail the paused turn. The harness adapter cuts long values.
 */
export const askUserHostToolOptionSchema = z.object({
	// Stable id; the answer sends it back in `selected`.
	id: z.string(),
	label: z.string(),
	// One short line under the label.
	description: z.string().optional(),
	// Folder name of a design world skill, for example `zellige`.
	worldId: z.string().optional(),
	// True on the option the agent advises; the tray shows a badge on it.
	recommended: z.boolean().optional(),
});

/** One question of an `ask_user` call; the tray shows it as one step. */
export const askUserHostToolQuestionSchema = z.object({
	question: z.string(),
	// Absent: free text without options, a single choice with options.
	kind: askUserKindSchema.optional(),
	options: z.array(askUserHostToolOptionSchema).default([]),
	// One short line under the question.
	helper: z.string().optional(),
	// Upload limit of an `attachments` question; the tray uses 3 when absent.
	maxFiles: z.int().optional(),
	// Marks the theme question of a web-app@1.1.0+ or desktop-app@1.0.0+ project. The agent sends
	// no options: the task adds 3 theme cards dealt for `business`, a
	// category of `set_theme` (an unknown one counts as "other").
	theme: z.object({ business: z.string() }).optional(),
});

/** One parsed `ask_user` question; `resolveAskUserKind` reads it. */
export type AskUserHostToolQuestion = z.infer<
	typeof askUserHostToolQuestionSchema
>;

/**
 * Input of the `ask_user` host tool: all questions of one step, in ONE
 * call. The Claude Code adapter pauses on the first host call, so a second
 * call in the same reply never reaches the user. The tool has no execute:
 * the turn pauses until the user answers in the chat.
 */
export const askUserHostToolInputSchema = z.object({
	questions: z.array(askUserHostToolQuestionSchema),
});

/** Parsed `ask_user` input; the harness adapter reads it from a paused call. */
export type AskUserHostToolInput = z.infer<typeof askUserHostToolInputSchema>;

/**
 * The tray body of an `ask_user` question. An explicit `kind` wins. Else a
 * question without options is free text and one with options a single choice.
 */
export function resolveAskUserKind(
	question: Pick<AskUserHostToolQuestion, "kind" | "options">,
): AskUserKind {
	return (
		question.kind ??
		(question.options.length === 0 ? "free-text" : "single-choice")
	);
}

/**
 * How the user closed an `ask_user` question. `delegated`: the user lets
 * the agent decide. `dismissed`: the user skipped the question.
 */
export const askUserHostToolActionSchema = z.enum([
	"answered",
	"delegated",
	"dismissed",
]);

/**
 * One file the user sent as an answer. `path` is the project-relative copy
 * the task wrote into the sandbox. It is null when the copy failed.
 */
export const askUserHostToolFileSchema = z.object({
	filename: z.string(),
	mediaType: z.string(),
	url: z.url(),
	path: z.string().nullable(),
});

/**
 * Output of the `ask_user` host tool, the tool result the agent reads: one
 * answer per question of the call. `text` holds what the user typed, also
 * for a skipped question; "" when the user typed nothing.
 */
export const askUserHostToolOutputSchema = z.object({
	answers: z.array(
		z.object({
			// The `question-N` id the adapter gave the question.
			questionId: z.string(),
			question: z.string(),
			action: askUserHostToolActionSchema,
			// The picked options, in the order of the question.
			selected: z.array(z.object({ id: z.string(), label: z.string() })),
			text: z.string(),
			files: z.array(askUserHostToolFileSchema),
			// What the host did with the answer, for the agent. A theme question
			// gets "Theme set: <name>." or "Theme kept: <name>.", then
			// "Do not edit src/styles/theme.json."
			hostNote: z.string().optional(),
		}),
	),
});

/** Parsed `ask_user` output; the task builds it from the user's answers. */
export type AskUserHostToolOutput = z.infer<typeof askUserHostToolOutputSchema>;

/**
 * One section of a `present_plan` plan, for example "Who uses it". The plan
 * card shows the title and one bullet per item.
 */
export const presentPlanSectionSchema = z.object({
	title: z.string(),
	items: z.array(z.string()).default([]),
});

/**
 * Input of the `present_plan` host tool: the plan of the app, or of one
 * change, in plain words for a non-technical user. Only Plan Mode turns
 * have the tool. It has no execute: the turn pauses until the user decides.
 * No length limits here, as for `ask_user`; the harness adapter cuts them.
 */
export const presentPlanHostToolInputSchema = z.object({
	// Short name of the plan, for example "Production tracker for your factory".
	title: z.string().default(""),
	// Two or three sentences: what the app does, for whom, and the main gain.
	summary: z.string().default(""),
	sections: z.array(presentPlanSectionSchema).default([]),
	// The choices the agent made for the user, for example for a skipped question.
	assumptions: z.array(z.string()).default([]),
});

/** Parsed `present_plan` input; the harness adapter reads it from a paused call. */
export type PresentPlanHostToolInput = z.infer<
	typeof presentPlanHostToolInputSchema
>;

/**
 * Output of the `present_plan` host tool, the tool result the agent reads.
 * It carries only change requests. An approval starts a new build turn
 * instead, because the paused Plan Mode turn cannot change files.
 */
export const presentPlanHostToolOutputSchema = z.object({
	// What the user asks to change in the plan, as the user typed it.
	feedback: z.string(),
});

/** Parsed `present_plan` output; the task builds it from the user's message. */
export type PresentPlanHostToolOutput = z.infer<
	typeof presentPlanHostToolOutputSchema
>;

/**
 * Input of the `web_search` host tool. The agent searches the web to confirm
 * a current doc, API, version, or error text. Each call costs credits.
 */
export const webSearchHostToolInputSchema = z.object({
	// 400 chars holds one focused question, for example an error text.
	query: z.string().min(1).max(400),
	// Each result adds one page of text to the Exa cost. 10 is the most that the fixed price covers.
	numResults: z.int().min(1).max(10).default(5),
	// Search only these sites, for example "react.dev" for the React docs.
	// 253 chars is the DNS limit of a host name.
	includeDomains: z.array(z.string().min(1).max(253)).max(10).optional(),
	// "deep" runs an Exa deep search: slower, more sources, a written answer, and a higher price.
	depth: z.enum(["standard", "deep"]).default("standard"),
});

/** Parsed `web_search` input; the tool execute body reads this shape. */
export type WebSearchHostToolInput = z.infer<
	typeof webSearchHostToolInputSchema
>;

/**
 * Output of the `web_search` host tool. The tool cuts `text` of a result and
 * `answer` to a fixed length. `failed` and `unavailable` carry a message for the agent.
 */
export const webSearchHostToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		// The answer that Exa writes from its sources. Only a "deep" search has it.
		answer: z.string().optional(),
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				// ISO date of the page, when Exa knows it.
				publishedDate: z.string().optional(),
				// Icon of the page's site, for the source chips. Always an https: URL;
				// the tool drops every other scheme, because the browser loads it.
				favicon: z.string().optional(),
				text: z.string(),
			}),
		),
	}),
	z.object({
		status: z.literal("failed"),
		message: z.string(),
	}),
	z.object({
		status: z.literal("unavailable"),
		message: z.string(),
	}),
]);

/** Parsed `web_search` output; the union of the three statuses. */
export type WebSearchHostToolOutput = z.infer<
	typeof webSearchHostToolOutputSchema
>;

/**
 * True for a public http(s) page address. The `web_fetch` and `capture_site`
 * tools and the clone chip of the web app call it. A false answer keeps a
 * private host or a credential out of the request to Firecrawl.
 */
export function isPublicWebUrl(value: string): boolean {
	let url: URL;

	// Safari 16 has no `URL.canParse`, and the web app calls this function.
	try {
		url = new URL(value);
	} catch {
		// `new URL` throws only for a text that is not a URL.
		return false;
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return false;
	}

	// Security check: a user name or a password in the URL can carry a secret out.
	if (url.username !== "" || url.password !== "") {
		return false;
	}

	const host = url.hostname;

	// Security check: no IP literal. The parser gives an IPv6 host in brackets.
	// It turns each IPv4 form, such as `2130706433` and `0x7f.1`, into digits and dots.
	if (host.startsWith("[") || /^[\d.]+$/.test(host)) {
		return false;
	}

	// A public host has a dot inside the name. `intranet` and `example.com.` do not pass.
	if (!host.includes(".") || host.endsWith(".")) {
		return false;
	}

	// Security check: these endings name hosts of a private network.
	return ![".localhost", ".local", ".internal"].some((ending) =>
		host.endsWith(ending),
	);
}

/**
 * A public http(s) URL, as `isPublicWebUrl` defines it. The inputs of
 * `web_fetch` and `capture_site` and the clone chip of the web app use it.
 */
export const publicWebUrlSchema = z
	.string()
	// 500 chars hold a long docs URL and limit the data that a URL can carry out.
	.max(500)
	.refine(isPublicWebUrl, "must be a public http(s) URL");

/**
 * A site address that a user types, such as `website.shop.dz`. An address
 * without a scheme gets `https://`. The output is a `publicWebUrlSchema` URL.
 * The "Clone website" step of the web app uses it.
 */
export const publicWebAddressSchema = z
	.string()
	.trim()
	// A scheme is letters, digits, "+", "-", or "." before "://". `ftp://x.com` keeps
	// its scheme, so the URL check refuses it.
	.transform((address) =>
		/^[a-z][a-z\d+.-]*:\/\//i.test(address) ? address : `https://${address}`,
	)
	.pipe(publicWebUrlSchema);

/**
 * Input of the `web_fetch` host tool. The agent reads one web page as
 * markdown, one part per call. A call that reaches Firecrawl costs credits.
 */
export const webFetchHostToolInputSchema = z.object({
	url: publicWebUrlSchema,
	// Index of the first markdown character of this part. `nextOffset` of the last call gives it.
	offset: z.int().min(0).default(0),
});

/** Parsed `web_fetch` input; the tool execute body reads this shape. */
export type WebFetchHostToolInput = z.infer<typeof webFetchHostToolInputSchema>;

/**
 * Output of the `web_fetch` host tool. `markdown` is one part of the page;
 * the tool cuts it to a fixed length. `failed` and `unavailable` carry a
 * message for the agent.
 */
export const webFetchHostToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("ok"),
		// The address of the page after redirects.
		url: z.string(),
		// Null when the page has no title.
		title: z.string().nullable(),
		markdown: z.string(),
		// Length of the full markdown of the page, in characters.
		totalChars: z.int(),
		// The `offset` of the next part. Null when this part is the last one.
		nextOffset: z.int().nullable(),
	}),
	z.object({
		status: z.literal("failed"),
		message: z.string(),
	}),
	z.object({
		status: z.literal("unavailable"),
		message: z.string(),
	}),
]);

/** Parsed `web_fetch` output; the union of the three statuses. */
export type WebFetchHostToolOutput = z.infer<
	typeof webFetchHostToolOutputSchema
>;

/**
 * Input of the `capture_site` host tool. The agent captures one public page
 * before it builds a copy of that page. Each call costs credits.
 */
export const captureSiteHostToolInputSchema = z.object({
	url: publicWebUrlSchema,
});

/** Parsed `capture_site` input; the tool execute body reads this shape. */
export type CaptureSiteHostToolInput = z.infer<
	typeof captureSiteHostToolInputSchema
>;

/**
 * The screenshot of one viewport of a capture, cut into bands from the top.
 * The `capture_site` output holds one for desktop and one for mobile.
 */
export const siteCaptureViewportSchema = z.object({
	// Sandbox paths of the band images, from the top of the page down.
	bandPaths: z.array(z.string()),
	// Height of one full band, in CSS px of the source page.
	bandHeightCssPx: z.int(),
	// Height of the captured page, in CSS px.
	pageHeightCssPx: z.int(),
	// True when the page is longer than the bands show.
	isCut: z.boolean(),
});

/** One viewport of a `capture_site` result; the tool builds it from the band files. */
export type SiteCaptureViewport = z.infer<typeof siteCaptureViewportSchema>;

/**
 * Output of the `capture_site` host tool. `captured` lists the reference
 * files that the tool wrote into the sandbox. `failed` and `unavailable`
 * carry a message for the agent.
 */
export const captureSiteHostToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("captured"),
		// 16 hex chars from the page address. `compare_clone` takes it as input.
		captureId: z.string(),
		// Sandbox folder that holds the reference files of this capture.
		dir: z.string(),
		// The address of the page after redirects.
		url: z.string(),
		// Null when the page has no title.
		title: z.string().nullable(),
		desktop: siteCaptureViewportSchema,
		// Null when the mobile capture failed. The desktop capture is then the only reference.
		mobile: siteCaptureViewportSchema.nullable(),
		// Number of image and font files copied into the project.
		assetCount: z.int(),
		// Number of files that the tool did not copy, for example a file above the size limit.
		skippedAssetCount: z.int(),
		// Limits of this capture that the agent tells the user.
		warnings: z.array(z.string()),
		// The clone rules that the agent follows for the rest of the turn.
		rules: z.string(),
	}),
	z.object({
		status: z.literal("failed"),
		message: z.string(),
	}),
	z.object({
		status: z.literal("unavailable"),
		message: z.string(),
	}),
]);

/** Parsed `capture_site` output; the union of the three statuses. */
export type CaptureSiteHostToolOutput = z.infer<
	typeof captureSiteHostToolOutputSchema
>;

/**
 * Input of the `compare_clone` host tool. The agent compares a screenshot of
 * its copy with the bands of one capture. The call is free.
 */
export const compareCloneHostToolInputSchema = z.object({
	// `captureId` of a `capture_site` result: 16 hex chars. The pattern keeps it safe in a path.
	captureId: z.string().regex(/^[a-f0-9]{16}$/),
	viewport: z.enum(["desktop", "mobile"]),
	// Sandbox path of a full-page screenshot of the copy. 300 chars hold a deep project path.
	screenshotPath: z.string().min(1).max(300),
});

/** Parsed `compare_clone` input; the tool execute body reads this shape. */
export type CompareCloneHostToolInput = z.infer<
	typeof compareCloneHostToolInputSchema
>;

/**
 * Output of the `compare_clone` host tool. `compared` gives the share of
 * different pixels for each band. `failed` carries a message for the agent.
 */
export const compareCloneHostToolOutputSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("compared"),
		viewport: z.enum(["desktop", "mobile"]),
		// Height of the source page, in CSS px.
		sourceHeightCssPx: z.int(),
		// Height of the copy in the screenshot, in CSS px.
		cloneHeightCssPx: z.int(),
		bands: z.array(
			z.object({
				// Band number from the top of the page. The first band is 1.
				band: z.int(),
				// Share of different pixels in this band, 0 to 100.
				mismatchPercent: z.number(),
				// Sandbox path of the source band image.
				sourcePath: z.string(),
				// Sandbox path of an image that marks the different pixels. Null when the band passes.
				diffPath: z.string().nullable(),
			}),
		),
		// The highest `mismatchPercent` of all bands.
		worstPercent: z.number(),
		// True when each band is at or below the pass limit.
		passed: z.boolean(),
		// Number of `compare_clone` calls that this turn can still make.
		callsLeft: z.int(),
	}),
	z.object({
		status: z.literal("failed"),
		message: z.string(),
	}),
]);

/** Parsed `compare_clone` output; the compared/failed union. */
export type CompareCloneHostToolOutput = z.infer<
	typeof compareCloneHostToolOutputSchema
>;

/**
 * The `capture.json` file of a capture folder. `capture_site` writes it and
 * `compare_clone` reads it back from the sandbox, so it is a trust boundary.
 */
export const siteCaptureManifestSchema = z.object({
	// The address of the captured page after redirects.
	url: z.string(),
	desktop: z.object({
		// 20 is the most desktop bands that one capture keeps.
		bandCount: z.int().min(1).max(20),
		// Height of the captured page, in CSS px.
		pageHeightCssPx: z.int().positive(),
	}),
	// Null when the capture has no mobile screenshot.
	mobile: z
		.object({
			// 24 is the most mobile bands that one capture keeps.
			bandCount: z.int().min(1).max(24),
			// Height of the captured page, in CSS px.
			pageHeightCssPx: z.int().positive(),
		})
		.nullable(),
});

/** Parsed `capture.json`; `compare_clone` reads the band counts from it. */
export type SiteCaptureManifest = z.infer<typeof siteCaptureManifestSchema>;

/**
 * One page that `web_fetch` keeps in Redis for 24 hours. A Redis value is a
 * trust boundary, so the cache parses each read with this schema.
 */
export const cachedWebPageSchema = z.object({
	// The address of the page after redirects.
	finalUrl: z.string(),
	// Null when the page has no title.
	title: z.string().nullable(),
	// The full markdown of the page. The tool cuts one part from it for each call.
	markdown: z.string(),
});

// 500 chars hold a long font stack or a gradient. The source page controls each value.
const siteStyleValueSchema = z.string().max(500).optional();

/**
 * The style map of a captured page: the box and the computed styles of each
 * visible element. A script that Firecrawl runs in the source page returns
 * it as JSON text, so the page controls the content.
 */
export const siteStyleMapSchema = z.object({
	// Width and height of the full page, in CSS px.
	pageWidth: z.number(),
	pageHeight: z.number(),
	nodes: z
		.array(
			z.object({
				// Index of the element in the map.
				id: z.int(),
				// `id` of the parent element. Null for the top element.
				parent: z.int().nullable(),
				// HTML tag name. 40 chars hold a long custom element name.
				tag: z.string().max(40),
				// Box of the element in the page, in CSS px from the top left corner.
				x: z.number(),
				y: z.number(),
				w: z.number(),
				h: z.number(),
				// The start of the element's own text.
				text: z.string().max(200).optional(),
				// The URL of an image or a video element. 2,000 chars hold a long CDN URL.
				src: z.string().max(2000).optional(),
				// Computed CSS values, as `getComputedStyle` gives them.
				style: z.object({
					color: siteStyleValueSchema,
					backgroundColor: siteStyleValueSchema,
					backgroundImage: siteStyleValueSchema,
					fontFamily: siteStyleValueSchema,
					fontSize: siteStyleValueSchema,
					fontWeight: siteStyleValueSchema,
					lineHeight: siteStyleValueSchema,
					letterSpacing: siteStyleValueSchema,
					textTransform: siteStyleValueSchema,
					textAlign: siteStyleValueSchema,
					padding: siteStyleValueSchema,
					margin: siteStyleValueSchema,
					border: siteStyleValueSchema,
					borderRadius: siteStyleValueSchema,
					boxShadow: siteStyleValueSchema,
					display: siteStyleValueSchema,
					flexDirection: siteStyleValueSchema,
					justifyContent: siteStyleValueSchema,
					alignItems: siteStyleValueSchema,
					gap: siteStyleValueSchema,
					gridTemplateColumns: siteStyleValueSchema,
					position: siteStyleValueSchema,
					opacity: siteStyleValueSchema,
					maxWidth: siteStyleValueSchema,
				}),
			}),
		)
		// 4,000 elements cover a long landing page and limit the size of the files.
		.max(4000),
});

/** Parsed style map of one viewport; the Firecrawl client returns it to `capture_site`. */
export type SiteStyleMap = z.infer<typeof siteStyleMapSchema>;

/**
 * Input of the `suggest_follow_ups` host tool: the next ideas the user can
 * try, written as prompts in the user's language. The chat shows each one as
 * a row under the answer; a click sends it as the next message.
 */
export const suggestFollowUpsHostToolInputSchema = z.object({
	// 2 or 3 ideas. 120 chars keeps each one on one row of the chat.
	// A repeat fails the call, so the agent sends a new list of 2 or 3 ideas.
	followUps: z
		.array(z.string().trim().min(3).max(120))
		.min(2)
		.max(3)
		.refine(
			(followUps) => new Set(followUps).size === followUps.length,
			"Each idea must be different",
		),
});

/** Parsed `suggest_follow_ups` input; the web parses the streamed tool input with it too. */
export type SuggestFollowUpsHostToolInput = z.infer<
	typeof suggestFollowUpsHostToolInputSchema
>;

/**
 * The fields of a 2xx answer of Exa `POST /search` that the `web_search` tool
 * reads (https://docs.exa.ai/reference/search, read 2026-11-22). Exa can send
 * more fields; zod drops them.
 */
export const exaSearchResponseSchema = z.object({
	requestId: z.string().optional(),
	results: z.array(
		z.object({
			// The schema says string, but a page without a title can answer null.
			title: z.string().nullable().optional(),
			url: z.string(),
			publishedDate: z.string().nullable().optional(),
			// Icon URL of the result's domain. The doc says string, but read it like `title`.
			favicon: z.string().nullable().optional(),
			// Present only when the request asks for `contents.text`.
			text: z.string().optional(),
		}),
	),
	// The estimated cost of this request, in US dollars.
	costDollars: z.object({ total: z.number().nonnegative() }).optional(),
	// Present only when the request sends `outputSchema`, which a deep search does.
	output: z
		.object({
			// The request asks for a text answer, so this is a string. Other content
			// becomes undefined on purpose: the results still hold the sources.
			content: z.string().optional().catch(undefined),
		})
		// A null output gives no answer; the paid results still reach the agent.
		.nullish(),
});

/** Parsed Exa search answer; the Exa client returns it to the tool. */
export type ExaSearchResponse = z.infer<typeof exaSearchResponseSchema>;

/**
 * The fields of an answer of Firecrawl `POST /v2/scrape` that the `web_fetch`
 * and `capture_site` tools read (https://docs.firecrawl.dev/api-reference/endpoint/scrape,
 * read 2026-11-19). Firecrawl can send more fields; zod drops them.
 */
export const firecrawlScrapeResponseSchema = z.object({
	// False when Firecrawl did not read the page. A DNS failure comes as HTTP 200 with false.
	success: z.boolean(),
	// Message and code of a failure, for example `SCRAPE_SITE_ERROR`.
	error: z.string().optional(),
	code: z.string().optional(),
	data: z
		.object({
			// Each of these is present only when the request asks for its format.
			markdown: z.string().optional(),
			rawHtml: z.string().optional(),
			// A URL of the screenshot file on the storage of Firecrawl.
			screenshot: z.string().optional(),
			// The URLs of the images of the page.
			images: z.array(z.string()).optional(),
			// Design tokens of the page. The code writes them to a file and reads no field.
			// A wrong form means "no branding", not a failed capture.
			branding: z.record(z.string(), z.unknown()).optional().catch(undefined),
			// `javascriptReturns` holds one value per `executeJavascript` action of the request.
			// A wrong form means "no style map", not a failed capture.
			actions: z
				.object({
					javascriptReturns: z.array(z.object({ value: z.string() })),
				})
				.optional()
				.catch(undefined),
			metadata: z
				.object({
					// Some pages give a title that is not a string. Read it as "no title".
					title: z.string().optional().catch(undefined),
					// The address of the page after redirects.
					url: z.string().optional(),
					// HTTP status of the target page, not of the Firecrawl call.
					statusCode: z.int().optional(),
					// Firecrawl credits of this call. The ledger cost comes from it.
					creditsUsed: z.number().optional(),
				})
				.optional(),
		})
		.optional(),
});

/** Parsed Firecrawl scrape answer; the Firecrawl client reads it. */
export type FirecrawlScrapeResponse = z.infer<
	typeof firecrawlScrapeResponseSchema
>;
