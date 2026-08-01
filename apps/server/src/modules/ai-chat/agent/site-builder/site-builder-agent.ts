/**
 * The BUILD brain: a ToolLoopAgent that writes a site into a virtual file
 * system instead of answering in prose.
 *
 * Runs inside the Trigger.dev task (outside Nest), so this file must stay
 * free of NestJS imports — everything the loop needs (model, system prompt,
 * inputs and ids) is passed in by the caller. Model strings resolve through the
 * AI SDK's default Vercel AI Gateway provider.
 *
 * The loop is ONE deliberate build pass → code review → rendered review →
 * finish. The finish guard refuses an unreviewed edit.
 */
import { PAGE_TOKEN_NAMES } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { isStepCount, type Tool, ToolLoopAgent, tool } from "ai";
import * as cheerio from "cheerio";
import { z } from "zod";

// Plain module (no Nest), safe in the Trigger bundle — cheerio bundles fine.
import {
	isStampableContainer,
	isStampableLeaf,
	stampHtml,
} from "../../../pages/domain/stamp";
import { BUILDER_REASONING_EFFORT_BY_MODEL } from "../tools/builder-model-options";

import type { BuildProgressEvent } from "./build-progress";
import {
	BUILD_IMAGE_ASPECTS,
	type BuildImageAspect,
	generateBuildImage,
	MAX_IMAGES,
} from "./generate-image";
import {
	type BuildVideoAspect,
	generateBuildVideo,
	MAX_VIDEOS,
	VIDEO_ASPECTS,
} from "./generate-video";
import {
	modelNeedsToolImageRelocation,
	modelNeedsToolImageStripping,
	relocateToolResultImages,
	stripToolResultImages,
} from "./relocate-tool-images";
import {
	type CapturedShot,
	createScreenshotSession,
	type ScreenshotCapture,
	type ScreenshotSession,
	ScreenshotUnavailableError,
} from "./screenshot";
import { type SiteFile, VirtualFileSystem } from "./virtual-files";

export type SiteBuildParams = {
	/** Abort both model generation and the streaming tool loop when the task is cancelled. */
	abortSignal?: AbortSignal;
	/** Names the R2 asset prefix for this build's generated assets. */
	attemptId: string;
	/** The one complete creative brief composed by the chat Brain. */
	brief: string;
	/** Gateway model string, snapshotted on the attempt (e.g. anthropic/claude-fable-5). */
	model: string;
	/** Live-progress sink (chat card via run metadata). Best-effort. */
	onEvent?: (event: BuildProgressEvent) => void;
	/** Generated images upload under this project's R2 prefix. */
	projectId: string;
	/** System prompt snapshotted at queue time — see builder-prompt.ts. */
	system: string;
	title: string;
};

export type SiteBuildResult = {
	files: SiteFile[];
	/** How many agent steps the build took (dashboard visibility only). */
	steps: number;
	/** The builder's own description of what it made, from the finish tool. */
	summary: string | null;
};

// Generous but bounded: one build pass + image generations + rendered review
// and correction. The accepted-finish flag is the intended exit; isStepCount
// is the runaway backstop (unused steps cost nothing).
const MAX_STEPS = 64;

// Full landing pages routinely exceed 30k chars of HTML; the ceiling must
// leave room for a complete write_file call in a single step.
const MAX_OUTPUT_TOKENS = 64_000;

// Two rendered review passes minimum — one correctness/structure hunt, one
// design-quality hunt with final verification. Counted only on successful
// captures and enforced TOGETHER with the final-revision gate, so re-shooting
// one draft twice cannot replace re-verifying the latest write. Exported for
// tests. (3 originally; tuned through 1 and 5 during the 2026-07-26
// experiments — 2 is the speed/quality compromise.)
export const REQUIRED_SCREENSHOT_PASSES = 2;

/**
 * Mutable loop state shared between the tools and the stop condition. A
 * plain object (not closure variables) so the guards are unit-testable.
 */
export type BuildLoopState = {
	failedEditRepeats: number;
	finishAccepted: boolean;
	/** R2 key sequence — monotonic, never reused even after a failed call. */
	imageSequence: number;
	imagesGenerated: number;
	lastFailedEditSearch: string | null;
	reviewedRevision: number;
	/** Successful screenshot_page captures — refused/unavailable calls do not count. */
	screenshotPasses: number;
	screenshotRequired: boolean;
	screenshotRevision: number;
	summary: string | null;
	/** Same monotonic-sequence discipline as images, for vid-{n} keys. */
	videoSequence: number;
	videosGenerated: number;
	writeRevision: number;
};

export function createBuildLoopState(
	screenshotRequired = true,
): BuildLoopState {
	return {
		failedEditRepeats: 0,
		finishAccepted: false,
		imageSequence: 0,
		imagesGenerated: 0,
		lastFailedEditSearch: null,
		reviewedRevision: 0,
		screenshotPasses: 0,
		screenshotRequired,
		screenshotRevision: 0,
		summary: null,
		videoSequence: 0,
		videosGenerated: 0,
		writeRevision: 0,
	};
}

/**
 * hasToolCall("finish") would stop the loop even when the finish tool
 * REFUSED (guards unmet) — stopping is gated on the accepted flag instead,
 * so a refused finish lets the loop continue. Exported for tests.
 */
export function buildStopConditions(state: BuildLoopState) {
	return [
		isStepCount(MAX_STEPS),
		(_options: { steps: unknown[] }) => state.finishAccepted,
	];
}

// Plain console on purpose: this file runs inside the Trigger.dev worker
// (and the smoke script), where console output lands in the terminal and the
// run dashboard — no Nest logger exists here.
function log(message: string): void {
	console.log(`[site-builder] ${message}`);
}

type CharacterSpan = { end: number; start: number };

function findWholeLineMatches(
	content: string,
	search: string,
	normalize: (line: string) => string,
): CharacterSpan[] {
	const contentEndsWithLineBreak = content.endsWith("\n");
	const contentLines = content.split("\n");
	const searchEndsWithLineBreak = search.endsWith("\n");
	const searchLines = search.split("\n");

	if (contentEndsWithLineBreak) {
		contentLines.pop();
	}

	if (searchEndsWithLineBreak) {
		searchLines.pop();
	}

	const lineStarts: number[] = [];
	let offset = 0;

	for (const line of contentLines) {
		lineStarts.push(offset);
		offset += line.length + 1;
	}

	const matches: CharacterSpan[] = [];

	for (
		let lineIndex = 0;
		lineIndex <= contentLines.length - searchLines.length;
		lineIndex += 1
	) {
		const matchesWindow = searchLines.every(
			(line, searchIndex) =>
				normalize(contentLines[lineIndex + searchIndex] ?? "") ===
				normalize(line),
		);

		if (!matchesWindow) {
			continue;
		}

		const lastLineIndex = lineIndex + searchLines.length - 1;
		const lastLine = contentLines[lastLineIndex] ?? "";
		const hasLineBreak =
			lastLineIndex < contentLines.length - 1 || contentEndsWithLineBreak;

		if (searchEndsWithLineBreak && !hasLineBreak) {
			continue;
		}

		const lastLineStart = lineStarts[lastLineIndex] ?? content.length;
		// Keep CRLF intact when the search does not include its final newline.
		const contentEnd =
			lastLineStart +
			lastLine.length -
			(hasLineBreak && lastLine.endsWith("\r") ? 1 : 0);
		const end = searchEndsWithLineBreak
			? lastLineStart + lastLine.length + 1
			: contentEnd;

		matches.push({ end, start: lineStarts[lineIndex] ?? 0 });
	}

	return matches;
}

const MAX_SCREENSHOT_DIAGNOSTICS = 5;

function compactScreenshotDiagnostics(entries: string[]): string[] {
	const unique = [...new Set(entries)];

	if (unique.length <= MAX_SCREENSHOT_DIAGNOSTICS) {
		return unique;
	}

	return [
		...unique.slice(0, MAX_SCREENSHOT_DIAGNOSTICS),
		`…and ${unique.length - MAX_SCREENSHOT_DIAGNOSTICS} more`,
	];
}

/**
 * Shared guard for both mutating tools (write_file, edit_file). Enforces the
 * one-file contract, and seals the build once finish is accepted: the SDK
 * runs a step's tool calls together, so a [finish, edit_file] step would
 * otherwise mutate the VFS AFTER the gates passed and publish a later
 * revision that never passed them.
 */
function assertMutationAllowed(
	state: BuildLoopState,
	path: string,
	action: "edit" | "write",
): void {
	if (path.trim().replace(/^\.?\//, "") !== "index.html") {
		throw new Error(
			`The site is exactly ONE file: "index.html" — refusing to ` +
				`${action} "${path}". Inline everything into index.html.`,
		);
	}

	if (state.finishAccepted) {
		throw new Error(
			"finish was already accepted — the build is sealed, no further " +
				`${action} is possible.`,
		);
	}
}

type BuilderToolsParams = {
	abortSignal?: AbortSignal;
	attemptId: string;
	onEvent?: (event: BuildProgressEvent) => void;
	projectId: string;
	screenshots: ScreenshotSession;
	state: BuildLoopState;
	vfs: VirtualFileSystem;
};

// Shared by the two zero-input tools so the BuilderTools alias and the tool
// definitions infer the exact same input type.
const emptyInputSchema = z.object({});

type EmptyInput = z.infer<typeof emptyInputSchema>;

type FinishOutput = { accepted: true } | { accepted: false; reason: string };

type AnimateImageOutput =
	| { message: string; status: "failed" | "unavailable" }
	| { posterUrl: string; status: "generated"; url: string };

type GenerateImageOutput =
	| { message: string; status: "failed" | "unavailable" }
	| {
			aspect: BuildImageAspect;
			role: string;
			status: "generated";
			url: string;
	  };

type ScreenshotPageOutput =
	| { message: string; refused: true }
	| { message: string; refused: false; unavailable: true }
	| {
			consoleErrors: string[];
			desktopShots: number;
			failedRequests: string[];
			mobileShots: number;
			overflow: { desktop: number; mobile: number };
			refused: false;
			revision: number;
			unavailable: false;
	  };

// Explicit (declaration-emit friendly) tool map; same alias-over-Record
// pattern as AiChatToolSet in chat-agent.ts.
export type BuilderTools = {
	animate_image: Tool<
		{ aspect: BuildVideoAspect; imageUrl: string; motionPrompt: string },
		AnimateImageOutput
	>;
	edit_file: Tool<
		{ path: string; replace: string; search: string },
		{ bytes: number; path: string }
	>;
	finish: Tool<{ summary: string }, FinishOutput>;
	generate_image: Tool<
		{ aspect: BuildImageAspect; prompt: string; role: string },
		GenerateImageOutput
	>;
	list_files: Tool<
		EmptyInput,
		{ files: Array<{ bytes: number; path: string }> }
	>;
	read_file: Tool<{ path: string }, { content: string; path: string }>;
	screenshot_page: Tool<EmptyInput, ScreenshotPageOutput>;
	write_file: Tool<
		{ content: string; path: string },
		{ bytes: number; path: string }
	>;
};

/**
 * The builder's tool set. Exported for tests: the guards (single-file
 * write_file, refused finish, image/video budgets) are code, not prompt
 * prose, and must stay verifiable without a model.
 */
export function createBuilderTools(params: BuilderToolsParams): BuilderTools {
	const { screenshots, state, vfs } = params;

	// toModelOutput must show the model images that the transcript output must
	// NOT carry — raw bytes are stashed per tool call and looked up by id.
	const imageByCall = new Map<string, { base64: string; mediaType: string }>();
	const shotsByCall = new Map<string, CapturedShot[]>();

	// Progress events feed the chat card; a listener bug must never be able
	// to fail a tool call, so every emission goes through this shield.
	const emitEvent = (event: BuildProgressEvent): void => {
		try {
			params.onEvent?.(event);
		} catch {
			// Progress is best-effort telemetry.
		}
	};

	return {
		animate_image: tool({
			description:
				"OPTIONAL: animate ONE existing image (a generate_image URL or a " +
				"user asset from the brief) into a short (~5s) looping ambient " +
				"background video. Use it ONLY when subtle motion genuinely " +
				"elevates a section — a hero atmosphere, a fabric drift — never by " +
				`default, never more than ${MAX_VIDEOS} per build. Embed the ` +
				'result as <video autoplay muted loop playsinline poster="<posterUrl>"> ' +
				"with the still image as poster. On unavailable/failed, keep the " +
				"still image — a page is never blocked on video.",
			inputSchema: z.object({
				aspect: z.enum(VIDEO_ASPECTS),
				imageUrl: z.url(),
				motionPrompt: z.string().min(10),
			}),
			execute: async ({ aspect, imageUrl, motionPrompt }) => {
				if (state.videoSequence >= MAX_VIDEOS) {
					return {
						message:
							`Video budget exhausted (${MAX_VIDEOS} per build) — keep ` +
							"the still image.",
						status: "failed" as const,
					};
				}

				// Reserve the attempt and key sequence synchronously before the
				// first await. A failed provider call still consumes the attempt,
				// preventing repeated expensive retries.
				state.videosGenerated += 1;
				state.videoSequence += 1;
				const index = state.videoSequence;

				const result = await generateBuildVideo({
					...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
					aspect,
					attemptId: params.attemptId,
					imageUrl,
					index,
					motionPrompt,
					projectId: params.projectId,
				});

				if (result.status !== "generated") {
					state.videosGenerated -= 1;
					log(`animate_image ${result.status}: ${result.message}`);

					return { message: result.message, status: result.status };
				}

				log(`animated image ${index}/${MAX_VIDEOS} → ${result.url}`);
				emitEvent({ type: "video-generated" });

				// The model cannot watch video — the URL text is all it needs, so
				// no toModelOutput override exists for this tool.
				return {
					posterUrl: imageUrl,
					status: "generated" as const,
					url: result.url,
				};
			},
		}),
		edit_file: tool({
			description:
				"Surgically replace ONE exact snippet inside index.html — the " +
				"tool for review-pass fixes, far cheaper and faster than " +
				"rewriting the whole file. The search text must match the " +
				"CURRENT file exactly (whitespace and indentation included) and " +
				"be unique — include enough surrounding lines to pin one " +
				"occurrence. For structural overhauls, rewrite with write_file.",
			inputSchema: z.object({
				path: z.string().min(1).describe('Must be "index.html".'),
				replace: z
					.string()
					.describe("The replacement text. Empty deletes the snippet."),
				search: z
					.string()
					.min(1)
					.describe(
						"Exact text currently in the file, unique across the file.",
					),
			}),
			execute: async ({ path, replace, search }) => {
				assertMutationAllowed(state, path, "edit");

				const current = vfs.read("index.html");

				if (current === null) {
					throw new Error(
						"index.html does not exist yet — write the complete first " +
							"draft with write_file before editing.",
					);
				}

				if (search === replace) {
					throw new Error(
						"search and replace are identical — nothing would change.",
					);
				}

				// indexOf stepping by ONE, not by search.length: split-based
				// counting misses overlapping occurrences (e.g. "</div></div>"
				// occurs twice inside "</div></div></div>"), silently accepting
				// an ambiguous edit this guard exists to refuse.
				let matchEnd = -1;
				let matchStart = -1;
				let occurrences = 0;
				for (
					let index = current.indexOf(search);
					index !== -1;
					index = current.indexOf(search, index + 1)
				) {
					if (occurrences === 0) {
						matchStart = index;
						matchEnd = index + search.length;
					}

					occurrences += 1;
				}

				// Fallback tiers slide across complete logical lines only. A
				// partial-line fragment can succeed through the exact tier, but is
				// never whitespace-normalized inside a larger line.
				if (occurrences === 0) {
					const trimEndMatches = findWholeLineMatches(current, search, (line) =>
						line.trimEnd(),
					);

					if (trimEndMatches.length > 0) {
						occurrences = trimEndMatches.length;
						matchStart = trimEndMatches[0]?.start ?? -1;
						matchEnd = trimEndMatches[0]?.end ?? -1;
					}
				}

				if (occurrences === 0) {
					const trimMatches = findWholeLineMatches(current, search, (line) =>
						line.trim(),
					);

					if (trimMatches.length > 0) {
						occurrences = trimMatches.length;
						matchStart = trimMatches[0]?.start ?? -1;
						matchEnd = trimMatches[0]?.end ?? -1;
					}
				}

				if (occurrences === 0) {
					if (state.lastFailedEditSearch === search) {
						state.failedEditRepeats += 1;
					} else {
						state.failedEditRepeats = 1;
						state.lastFailedEditSearch = search;
					}

					if (state.failedEditRepeats >= 2) {
						throw new Error(
							"search text not found in index.html again. STOP retrying " +
								"this snippet. Call read_file to see the current file and " +
								"copy a snippet verbatim from it — or rewrite the section " +
								"with write_file if the edit keeps failing.",
						);
					}

					throw new Error(
						"search text not found in index.html. It must match the " +
							"CURRENT file exactly, including whitespace and " +
							"indentation — re-read the file with read_file and copy " +
							"the snippet verbatim.",
					);
				}

				if (occurrences > 1) {
					throw new Error(
						`search text appears ${occurrences} times in index.html — ` +
							"extend it with surrounding lines until it matches " +
							"exactly once.",
					);
				}

				// Slice assembly avoids String.replace expanding $-patterns ($&,
				// $', $$…) and replaces the original whitespace-bearing span found
				// by the line tiers, not the model's normalized search text.
				const matched = current.slice(matchStart, matchEnd);
				const content =
					current.slice(0, matchStart) + replace + current.slice(matchEnd);
				const written = vfs.write("index.html", content);
				state.failedEditRepeats = 0;
				state.lastFailedEditSearch = null;
				state.writeRevision += 1;
				const bytes = Buffer.byteLength(content, "utf-8");
				emitEvent({ bytes, html: content, kind: "edit", type: "page-written" });
				const delta =
					Buffer.byteLength(replace, "utf-8") -
					Buffer.byteLength(matched, "utf-8");

				log(
					`edited ${written} (${delta >= 0 ? "+" : ""}${delta} bytes → ` +
						`${Math.round(bytes / 1024)} KB, revision ${state.writeRevision})`,
				);

				return { bytes, path: written };
			},
		}),
		finish: tool({
			description:
				"Declare the site complete. Call this ONCE, only after the " +
				"required screenshot_page review (minimum " +
				`${REQUIRED_SCREENSHOT_PASSES} per build) and a ` +
				"visual review of the final index.html. A full write_file is " +
				"source-reviewed automatically; after edit_file, re-read the " +
				"file with read_file before finishing.",
			inputSchema: z.object({
				summary: z
					.string()
					.min(1)
					.describe("2-3 sentences describing the direction you built."),
			}),
			execute: async (input) => {
				if (vfs.read("index.html") === null) {
					log("finish refused — index.html has not been written");

					return {
						accepted: false as const,
						reason:
							"index.html has not been written yet. Write the complete " +
							"page, then finish.",
					};
				}

				if (state.reviewedRevision !== state.writeRevision) {
					log("finish refused — the final edit has not been re-read");

					return {
						accepted: false as const,
						reason:
							"Re-read the current index.html with read_file after the " +
							"latest edit_file, review it, then finish. A full " +
							"write_file is reviewed automatically.",
					};
				}

				if (
					state.screenshotRequired &&
					state.screenshotPasses < REQUIRED_SCREENSHOT_PASSES
				) {
					log(
						`finish refused — only ${state.screenshotPasses} of ` +
							`${REQUIRED_SCREENSHOT_PASSES} screenshot review passes done`,
					);

					return {
						accepted: false as const,
						reason:
							`Only ${state.screenshotPasses} of ` +
							`${REQUIRED_SCREENSHOT_PASSES} required screenshot review ` +
							"passes are recorded. Review the renders against the " +
							"brief, improve the page, then call " +
							"screenshot_page again.",
					};
				}

				if (
					state.screenshotRequired &&
					state.screenshotRevision !== state.writeRevision
				) {
					log(
						"finish refused — the final index.html has not been screenshot-reviewed",
					);

					return {
						accepted: false as const,
						reason:
							"Call screenshot_page on the current index.html after the latest write or edit, review its desktop/mobile renders and diagnostics, then finish.",
					};
				}

				assertValidSite(vfs);

				state.summary = input.summary;
				state.finishAccepted = true;
				log("builder declared the page finished");
				emitEvent({ summary: input.summary, type: "finished" });

				return { accepted: true as const };
			},
		}),
		generate_image: tool({
			description:
				"Generate ONE image from the brief's SHOT LIST and host it. Follow " +
				"the brief's image-prompt conventions exactly — never text, logos or " +
				"watermarks inside an image. Returns the hosted URL, the ONLY kind " +
				"of external image the page may use besides user assets listed in " +
				`the brief. Max ${MAX_IMAGES} attempts per build; on ` +
				"unavailable/failed, build CSS/SVG art for that role instead.",
			inputSchema: z.object({
				aspect: z.enum(BUILD_IMAGE_ASPECTS),
				prompt: z.string().min(20),
				role: z.string().min(1),
				// User asset URLs from the brief's BRAND ASSETS — edit the user's
				// real photos instead of inventing the product.
				sourceImageUrls: z.array(z.url()).max(3).optional(),
			}),
			execute: async (
				{ aspect, prompt, role, sourceImageUrls },
				{ toolCallId },
			) => {
				if (state.imageSequence >= MAX_IMAGES) {
					return {
						message:
							`Image budget exhausted (${MAX_IMAGES} per build) — build ` +
							"CSS/SVG art instead.",
						status: "failed" as const,
					};
				}

				// One step's tool calls run CONCURRENTLY (the SDK Promise.alls
				// them), so the attempt and key sequence are reserved before the
				// first await. Parallel calls cannot exceed the cap or share an R2
				// key. A provider failure still consumes the attempt.
				state.imagesGenerated += 1;
				state.imageSequence += 1;
				const index = state.imageSequence;
				emitEvent({ role, type: "image-start" });

				const result = await generateBuildImage({
					...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
					aspect,
					attemptId: params.attemptId,
					index,
					projectId: params.projectId,
					prompt,
					...(sourceImageUrls?.length ? { sourceImageUrls } : {}),
				});

				if (result.status !== "generated") {
					state.imagesGenerated -= 1;
					log(`generate_image ${result.status}: ${result.message}`);

					return { message: result.message, status: result.status };
				}

				imageByCall.set(toolCallId, {
					base64: result.imageBase64,
					mediaType: result.mediaType,
				});
				log(`generated image ${index}/${MAX_IMAGES} (${role}) → ${result.url}`);
				emitEvent({ role, type: "image-generated", url: result.url });

				return {
					aspect,
					role,
					status: "generated" as const,
					url: result.url,
				};
			},
			toModelOutput: ({ output, toolCallId }) => {
				if (output.status !== "generated") {
					return {
						type: "content",
						value: [
							{ text: `${output.status}: ${output.message}`, type: "text" },
						],
					};
				}

				const image = imageByCall.get(toolCallId);

				return {
					type: "content",
					value: [
						{
							text:
								`Generated (${output.role}, ${output.aspect}): ${output.url} ` +
								"— judge whether it fits the design before placing it.",
							type: "text",
						},
						...(image
							? [
									{
										data: { data: image.base64, type: "data" as const },
										mediaType: image.mediaType,
										type: "file" as const,
									},
								]
							: []),
					],
				};
			},
		}),
		list_files: tool({
			description: "List every file written so far (paths and sizes).",
			inputSchema: emptyInputSchema,
			execute: async () => ({ files: vfs.list() }),
		}),
		read_file: tool({
			description:
				"Read back one file you wrote, to review and improve it. This " +
				"is required after edit_file before finish, but not solely " +
				"because write_file wrote the complete file.",
			inputSchema: z.object({
				path: z.string().min(1),
			}),
			execute: async ({ path }) => {
				const content = vfs.read(path);

				if (content === null) {
					throw new Error(`No such file: ${path}`);
				}

				if (path.trim().replace(/^\.?\//, "") === "index.html") {
					state.reviewedRevision = state.writeRevision;
				}

				log(`re-reading ${path} to review it`);

				return { content, path };
			},
		}),
		screenshot_page: tool({
			description:
				"Render the current index.html in a real browser for one required " +
				`review pass (minimum ${REQUIRED_SCREENSHOT_PASSES} per ` +
				"build). Returns desktop (1440×900) and mobile (390×844) " +
				"screenshots from top to bottom, console/page errors, failed " +
				"asset requests, and horizontal-overflow measurements. After " +
				"any subsequent write_file or edit_file, call this again.",
			inputSchema: emptyInputSchema,
			execute: async (_input, { toolCallId }) => {
				const html = vfs.read("index.html");

				if (html === null) {
					return {
						message:
							"index.html has not been written yet — write it first, then screenshot it.",
						refused: true as const,
					};
				}

				// The captured HTML belongs to this revision even if another tool
				// call writes a newer revision while Playwright is rendering.
				const revision = state.writeRevision;
				emitEvent({
					pass: state.screenshotPasses + 1,
					type: "screenshot-start",
				});
				let capture: ScreenshotCapture;

				try {
					capture = await screenshots.capture(html);
				} catch (error) {
					if (!(error instanceof ScreenshotUnavailableError)) {
						throw error;
					}

					state.screenshotRequired = false;
					log(
						`visual review unavailable at runtime — ${error.message}; ` +
							"continuing with code-review-only gate",
					);

					return {
						message:
							`${error.message}. Visual review is unavailable in this ` +
							"runtime; continue with a rigorous source review, using " +
							"read_file after any edit.",
						refused: false as const,
						unavailable: true as const,
					};
				}

				if (capture.shots.length === 0) {
					return {
						message:
							"The browser returned no screenshots. The visual review was not recorded; call screenshot_page again.",
						refused: true as const,
					};
				}

				state.screenshotPasses += 1;
				state.screenshotRevision = revision;
				shotsByCall.set(toolCallId, capture.shots);
				emitEvent({
					consoleErrors: capture.consoleErrors,
					failedRequests: capture.failedRequests,
					overflow: capture.overflow,
					pass: state.screenshotPasses,
					shots: capture.shots,
					type: "screenshot-pass",
				});

				const desktopShots = capture.shots.filter(
					(shot) => shot.viewport === "desktop",
				).length;
				const mobileShots = capture.shots.length - desktopShots;

				log(
					`screenshot-reviewed revision ${revision} — ` +
						`${capture.shots.length} shots, ` +
						`${capture.consoleErrors.length} console errors, ` +
						`${capture.failedRequests.length} failed requests`,
				);

				// The progress card keeps full diagnostics; only the tool result is
				// bounded because it is copied into every later model step.
				const consoleErrors = compactScreenshotDiagnostics(
					capture.consoleErrors,
				);
				const failedRequests = compactScreenshotDiagnostics(
					capture.failedRequests,
				);

				return {
					consoleErrors,
					desktopShots,
					failedRequests,
					mobileShots,
					overflow: capture.overflow,
					refused: false as const,
					revision,
					unavailable: false as const,
				};
			},
			toModelOutput: ({ output, toolCallId }) => {
				if (output.refused || output.unavailable) {
					return {
						type: "content",
						value: [{ text: output.message, type: "text" }],
					};
				}

				const shots = shotsByCall.get(toolCallId) ?? [];
				const errors =
					output.consoleErrors.length > 0
						? output.consoleErrors.join(" | ")
						: "none";
				const failedRequests =
					output.failedRequests.length > 0
						? output.failedRequests.join(" | ")
						: "none";
				const overflowText = (px: number) => (px > 1 ? `${px}px` : "none");

				return {
					type: "content",
					value: [
						{
							text:
								`Screenshot review of revision ${output.revision}. ` +
								`Desktop: ${output.desktopShots} shots, mobile: ` +
								`${output.mobileShots} shots. Console/page errors: ` +
								`${errors}. Failed requests: ${failedRequests}. ` +
								"Horizontal overflow: desktop " +
								`${overflowText(output.overflow.desktop)}, mobile ` +
								`${overflowText(output.overflow.mobile)}.`,
							type: "text",
						},
						...shots.map((shot) => ({
							data: { data: shot.base64, type: "data" as const },
							mediaType: "image/jpeg",
							type: "file" as const,
						})),
					],
				};
			},
		}),
		write_file: tool({
			description:
				"Create or overwrite ONE complete file of the site. The site " +
				'must be a single self-contained "index.html" — writing any ' +
				"other file fails the build. This tool always takes the WHOLE " +
				"file; for targeted fixes use edit_file instead. After the first " +
				"draft, a rewrite is ONLY for changing the page's fundamental " +
				"structure — never to consolidate, reformat, or clean up (a " +
				"rewrite streams the entire file again and costs minutes). " +
				"The complete content is marked source-reviewed automatically; " +
				"do not call read_file solely because you wrote it.",
			inputSchema: z.object({
				content: z.string().min(1),
				path: z.string().min(1).describe('Relative path, e.g. "index.html".'),
			}),
			execute: async ({ content, path }) => {
				// The one-file contract is enforced here, not just in the prompt:
				// the preview cannot serve sibling assets, so any other path is
				// rejected before it ever lands in the VFS.
				assertMutationAllowed(state, path, "write");

				const written = vfs.write(path, content);
				state.writeRevision += 1;

				// The model just supplied every byte, so reading the same full file
				// back would add context tokens without revealing new information.
				state.reviewedRevision = state.writeRevision;
				const bytes = Buffer.byteLength(content, "utf-8");

				log(`wrote ${written} (${Math.round(bytes / 1024)} KB)`);
				emitEvent({
					bytes,
					html: content,
					kind: "write",
					type: "page-written",
				});

				return { bytes, path: written };
			},
			// Fires when the model STARTS streaming the file content — the one
			// live signal that the page is being written (the write itself can
			// stream for minutes before execute ever runs).
			onInputStart: () => {
				emitEvent({ type: "write-start" });
			},
		}),
	};
}

export async function runSiteBuild(
	params: SiteBuildParams,
): Promise<SiteBuildResult> {
	const vfs = new VirtualFileSystem();
	const screenshotRequired = !modelNeedsToolImageStripping(params.model);
	const state = createBuildLoopState(screenshotRequired);
	const screenshots = createScreenshotSession(
		params.attemptId,
		params.abortSignal,
	);
	const startedAt = Date.now();

	// Read at BUILD time (not snapshotted like the model): a knob for quick
	// reasoning experiments across builder models. Every provider reads only
	// its own providerOptions key, so both are always safe to send. Merged
	// into ONE providerOptions object with the gateway ordering below — two
	// separate spreads would overwrite each other.
	// Per-model overrides win over the env knob; resolve "auto" afterward so an
	// override still applies when the env defers to the provider.
	const configuredReasoningEffort =
		BUILDER_REASONING_EFFORT_BY_MODEL[params.model] ??
		env.AI_PAGE_DESIGN_REASONING;
	const reasoningEffort =
		configuredReasoningEffort === "auto"
			? undefined
			: configuredReasoningEffort;
	const providerOptions = {
		...(reasoningEffort
			? {
					// Gemini 3 knows exactly two thinking levels — medium+ → high.
					google: {
						thinkingConfig: {
							thinkingLevel:
								reasoningEffort === "minimal" || reasoningEffort === "low"
									? ("low" as const)
									: ("high" as const),
						},
					},
					openai: { reasoningEffort },
					// Grok knows exactly three efforts — clamp both ends.
					xai: {
						reasoningEffort:
							reasoningEffort === "minimal"
								? ("low" as const)
								: reasoningEffort === "xhigh"
									? ("high" as const)
									: reasoningEffort,
					},
				}
			: {}),
		// Novita-first was a fix for Kimi K2's launch congestion (6s+ TTFT on
		// Moonshot). K3 measured faster on official Moonshot routing, so the
		// preference stays scoped to K2-era models.
		...(params.model.startsWith("moonshotai/kimi-k2")
			? { gateway: { order: ["novita"] } }
			: {}),
		// Qwen's default routing lands on Alibaba Cloud/Together at ~55 tps;
		// Fireworks serves the same models at ~330 tps (gateway P50 chart,
		// 2026-07-26). The others stay as fallback.
		...(params.model.startsWith("alibaba/")
			? { gateway: { order: ["fireworks"] } }
			: {}),
	};

	log(
		`starting build of "${params.title}" with model ${params.model}` +
			(reasoningEffort ? ` (reasoning: ${reasoningEffort})` : ""),
	);

	if (!screenshotRequired) {
		log(
			`visual review disabled — ${params.model} is text-only; ` +
				"using the code-review-only gate",
		);
	}

	try {
		const agent = new ToolLoopAgent({
			instructions: params.system,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			model: params.model,
			...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
			// Kimi/Moonshot rejects image parts inside tool results (they fall
			// through as base64 TEXT and blow the context) but reads images fine
			// from user messages — so relocate them there before every step.
			// (K2-era models additionally prefer Novita routing — set in
			// providerOptions above.)
			// Text-only models (DeepSeek) cannot see images anywhere, so image
			// parts are stripped instead — the tool result's URL text line is
			// all they need to place assets.
			...(modelNeedsToolImageRelocation(params.model)
				? {
						prepareStep: ({ messages }) => {
							const relocated = relocateToolResultImages(messages);

							return relocated === messages
								? undefined
								: { messages: relocated };
						},
					}
				: {}),
			...(modelNeedsToolImageStripping(params.model)
				? {
						prepareStep: ({ messages }) => {
							const stripped = stripToolResultImages(messages);

							return stripped === messages ? undefined : { messages: stripped };
						},
					}
				: {}),
			stopWhen: buildStopConditions(state),
			tools: createBuilderTools({
				abortSignal: params.abortSignal,
				attemptId: params.attemptId,
				...(params.onEvent ? { onEvent: params.onEvent } : {}),
				projectId: params.projectId,
				screenshots,
				state,
				vfs,
			}),
		});

		// stream(), NOT generate(): a non-streaming call buffers the entire
		// generation server-side before sending response headers, and a full-page
		// write step routinely exceeds Node's 5-minute undici headersTimeout
		// (observed as GatewayTimeoutError 408). Streaming receives headers
		// immediately; nothing here consumes deltas — the stream is just drained.
		const stream = await agent.stream({
			abortSignal: params.abortSignal,
			prompt:
				`Build the landing page now.\n\nTITLE: ${params.title}\n\n` +
				`BRIEF:\n${params.brief}`,
		});

		// Model-call failures don't throw while draining: the SDK enqueues them
		// as {type:"error"} stream parts (consumeStream's onError only fires
		// when reading itself fails). Drain fullStream and capture the first
		// real cause — it must land in the attempt row instead of a misleading
		// generic "stopped without an accepted finish".
		let streamError: unknown;
		try {
			for await (const part of stream.fullStream) {
				if (part.type === "error" && streamError === undefined) {
					streamError = part.error;
				}
			}
		} catch (error) {
			streamError ??= error;
		}

		if (streamError !== undefined) {
			throw streamError instanceof Error
				? streamError
				: new Error(String(streamError));
		}

		const steps = await stream.steps;
		const summary = state.summary;

		// An accepted finish is the ONLY valid exit: a natural stop or the step
		// backstop means the model abandoned the protocol mid-build, and an
		// interim draft must never be published as a succeeded version.
		if (summary === null) {
			throw new Error(
				"The builder stopped without an accepted finish " +
					`(${steps.length} steps) — refusing to publish an ` +
					"unfinished build",
			);
		}

		// Deterministic stamping pass (spec §4): every editable leaf gets a
		// stable data-wid before upload, so every version's canonical HTML in
		// R2 is fully stamped. The model is never asked to do this itself.
		const rawHtml = vfs.read("index.html");

		if (rawHtml !== null) {
			vfs.write("index.html", stampHtml(rawHtml));
		}

		assertValidSite(vfs);

		const reviewMode = state.screenshotRequired
			? `${state.screenshotPasses} screenshot passes ` +
				`(final revision ${state.screenshotRevision})`
			: "code-review-only";
		log(
			`build done in ${Math.round((Date.now() - startedAt) / 1000)}s — ` +
				`${steps.length} steps, ${reviewMode}, ` +
				`${state.imagesGenerated} images`,
		);

		return {
			files: vfs.toFiles(),
			steps: steps.length,
			summary,
		};
	} finally {
		// The Trigger worker process may be reused for the next build.
		await screenshots.dispose();
	}
}

/**
 * The build must fail loudly here — inside the task, before any upload —
 * when the agent produced nothing shippable. These errors land verbatim in
 * the attempt row, so they are written for a human reading the Page tab.
 *
 * v1 contract: EXACTLY one self-contained index.html. The preview renders
 * that single document through iframe srcDoc, so a sibling styles.css would
 * upload fine yet 404 at view time — better to fail the build than to
 * record a succeeded version that renders broken.
 */
const BRAND_MARKER_WRAPPER_SELECTOR = "a, figure, article";
const BRAND_SECTION_SCOPE_SELECTOR = "nav, header, section, footer, aside";

function assertValidBrandMarkers(html: string): void {
	const $ = cheerio.load(html);
	const brandMarkers = $("[data-brand]");

	brandMarkers.each((_, node) => {
		const marker = $(node);
		const role = marker.attr("data-brand");

		if (role !== "nav" && role !== "footer") {
			throw new Error(
				`index.html has unsupported data-brand role "${role ?? ""}" — ` +
					'brand markers must use exactly data-brand="nav" or data-brand="footer"',
			);
		}

		if (!marker.is(BRAND_MARKER_WRAPPER_SELECTOR)) {
			throw new Error(
				`data-brand="${role}" must be on a stampable <a>, <figure>, or ` +
					`<article> wrapper (found <${node.tagName}>) — never put the ` +
					"marker on a div, image, SVG, or decorative child",
			);
		}

		const isStampable = marker.is("a")
			? isStampableLeaf($, node)
			: isStampableContainer($, node);

		if (!isStampable) {
			throw new Error(
				`data-brand="${role}" is on <${node.tagName}>, but that wrapper ` +
					"is not stampable in this location — keep it outside SVG/form " +
					"content and inside the recognized nav/header/footer chassis",
			);
		}

		const hasTextContent = marker.text().trim().length > 0;
		const hasAriaLabel = (marker.attr("aria-label") ?? "").trim().length > 0;
		const hasImageAlt = marker
			.find("img")
			.toArray()
			.some((image) => ($(image).attr("alt") ?? "").trim().length > 0);

		if (!hasTextContent && !hasAriaLabel && !hasImageAlt) {
			throw new Error(
				`data-brand="${role}" must include restorable brand text: non-empty ` +
					"text content, aria-label, or an inner <img> with non-empty alt",
			);
		}
	});

	const navMarkers = $('[data-brand="nav"]');

	if (navMarkers.length !== 1) {
		throw new Error(
			'index.html must contain exactly one data-brand="nav" marker on ' +
				`the replaceable nav/header brand wrapper (found ${navMarkers.length})`,
		);
	}

	const navScope = navMarkers
		.first()
		.closest(BRAND_SECTION_SCOPE_SELECTOR)
		.first();

	if (
		!navScope.is("nav, header") ||
		navMarkers.first().closest("footer").length > 0
	) {
		throw new Error(
			'data-brand="nav" must be inside the nav/header chassis, with its ' +
				"nearest section scope being <nav> or <header>",
		);
	}

	const footerMarkers = $('[data-brand="footer"]');

	if (footerMarkers.length > 1) {
		throw new Error(
			'index.html may contain at most one data-brand="footer" marker ' +
				`(found ${footerMarkers.length})`,
		);
	}

	if (
		footerMarkers.length === 1 &&
		footerMarkers.first().closest("footer").length === 0
	) {
		throw new Error(
			'data-brand="footer" must be inside the page footer wordmark',
		);
	}
}

function assertValidSite(vfs: VirtualFileSystem): void {
	const html = vfs.read("index.html");

	if (html === null) {
		throw new Error(
			"The builder finished without writing index.html — nothing to publish",
		);
	}

	const extraFiles = vfs
		.list()
		.map((file) => file.path)
		.filter((path) => path !== "index.html");

	if (extraFiles.length > 0) {
		throw new Error(
			`The builder wrote extra files (${extraFiles.join(", ")}) — the ` +
				"current contract is ONE self-contained index.html, because the " +
				"preview cannot serve sibling assets yet",
		);
	}

	const trimmed = html.trim();
	const start = trimmed.slice(0, 20).toLowerCase();

	if (!start.startsWith("<!doctype") && !start.startsWith("<html")) {
		throw new Error(
			"index.html does not start with an HTML document (got: " +
				`${trimmed.slice(0, 80)}…)`,
		);
	}

	if (!trimmed.toLowerCase().endsWith("</html>")) {
		throw new Error(
			"index.html does not end with </html> — the document is truncated; " +
				"refusing to publish it",
		);
	}

	if (trimmed.length < 2000) {
		throw new Error(
			`index.html is suspiciously short (${trimmed.length} chars) — ` +
				"a real landing page never is; refusing to publish it",
		);
	}

	assertValidBrandMarkers(html);

	const firstStyle = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/i.exec(html);

	if (!firstStyle) {
		throw new Error(
			"index.html is missing a <style> block — its first <style> must " +
				"contain the required :root page-theme token block",
		);
	}

	const firstStyleCss = firstStyle[1] ?? "";
	const firstStyleCssWithoutComments = firstStyleCss.replace(
		/\/\*[\s\S]*?\*\//g,
		(comment) => " ".repeat(comment.length),
	);
	const root = /:root\s*\{([^}]*)\}/.exec(firstStyleCssWithoutComments);

	if (!root) {
		throw new Error(
			"index.html's first <style> must contain a :root block declaring " +
				"all required page-theme tokens",
		);
	}

	const rootDeclarations = root[1] ?? "";
	const missingTokens = PAGE_TOKEN_NAMES.filter(
		(token) => !new RegExp(`(?:^|;)\\s*--${token}\\s*:`).test(rootDeclarations),
	);

	if (missingTokens.length > 0) {
		throw new Error(
			"index.html's first <style> :root is missing required page-theme " +
				`tokens (${missingTokens.map((token) => `--${token}`).join(", ")}) — ` +
				"declare every contract token before finishing",
		);
	}

	const styleOpenEnd = (firstStyle.index ?? 0) + firstStyle[0].indexOf(">") + 1;
	const rootStart = styleOpenEnd + root.index;
	const rootEnd = rootStart + root[0].length;
	const outsideOpeningRoot = html.slice(0, rootStart) + html.slice(rootEnd);
	const outsideRootDeclarations = outsideOpeningRoot
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/:root\s*\{[^}]*\}/gi, "");
	const requiredConsumptions = [
		"background",
		"foreground",
		"primary",
		"font-body",
		"radius",
	] as const;
	const unconsumedTokens = requiredConsumptions.filter(
		(token) =>
			!new RegExp(`var\\(\\s*--${token}\\s*[,)]`).test(outsideRootDeclarations),
	);

	if (unconsumedTokens.length > 0) {
		throw new Error(
			"index.html declares but does not consume required page-theme tokens " +
				`outside :root (${unconsumedTokens
					.map((token) => `--${token}`)
					.join(", ")}) — reference each with var(--token) in the page styles`,
		);
	}
}
