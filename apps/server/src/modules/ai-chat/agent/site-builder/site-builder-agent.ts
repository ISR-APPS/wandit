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
 * finish. The finish guard refuses an unreviewed write.
 */
import { env } from "@wandit/env/server";
import { isStepCount, type Tool, ToolLoopAgent, tool } from "ai";
import { z } from "zod";

// Plain module (no Nest), safe in the Trigger bundle — cheerio bundles fine.
import { stampHtml } from "../../../pages/domain/stamp";

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

// Three rendered review passes minimum — correctness, creative fidelity, and
// final verification. Counted only on successful captures and enforced
// TOGETHER with the final-revision gate, so re-shooting one draft three
// times cannot replace re-verifying the latest write. Exported for tests.
export const REQUIRED_SCREENSHOT_PASSES = 3;

/**
 * Mutable loop state shared between the tools and the stop condition. A
 * plain object (not closure variables) so the guards are unit-testable.
 */
export type BuildLoopState = {
	finishAccepted: boolean;
	/** R2 key sequence — monotonic, never reused even after a failed call. */
	imageSequence: number;
	imagesGenerated: number;
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
		finishAccepted: false,
		imageSequence: 0,
		imagesGenerated: 0,
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

type BuilderToolsParams = {
	abortSignal?: AbortSignal;
	attemptId: string;
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

				// The model cannot watch video — the URL text is all it needs, so
				// no toModelOutput override exists for this tool.
				return {
					posterUrl: imageUrl,
					status: "generated" as const,
					url: result.url,
				};
			},
		}),
		finish: tool({
			description:
				"Declare the site complete. Call this ONCE, only after " +
				`${REQUIRED_SCREENSHOT_PASSES} screenshot_page review passes and a ` +
				"re-read plus visual review of the final index.html.",
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
					log("finish refused — the final index.html has not been re-read");

					return {
						accepted: false as const,
						reason:
							"Re-read the current index.html with read_file after the latest write, review it, then finish.",
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
							"Call screenshot_page on the current index.html after the latest write, review its desktop/mobile renders and diagnostics, then finish.",
					};
				}

				state.summary = input.summary;
				state.finishAccepted = true;
				log("builder declared the page finished");

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
			description: "Read back one file you wrote, to review and improve it.",
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
				`review pass (${REQUIRED_SCREENSHOT_PASSES} passes minimum per ` +
				"build). Returns desktop (1440×900) and mobile (390×844) " +
				"screenshots from top to bottom, console/page errors, failed " +
				"asset requests, and horizontal-overflow measurements. After " +
				"any subsequent write_file, call this again.",
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
							"runtime; continue with a rigorous read_file code review.",
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

				return {
					consoleErrors: capture.consoleErrors,
					desktopShots,
					failedRequests: capture.failedRequests,
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
				"other file fails the build. Always write the whole file — " +
				"there are no partial edits.",
			inputSchema: z.object({
				content: z.string().min(1),
				path: z.string().min(1).describe('Relative path, e.g. "index.html".'),
			}),
			execute: async ({ content, path }) => {
				// The one-file contract is enforced here, not just in the prompt:
				// the preview cannot serve sibling assets, so any other path is
				// rejected before it ever lands in the VFS.
				if (path.trim().replace(/^\.?\//, "") !== "index.html") {
					throw new Error(
						`The site is exactly ONE file: "index.html" — refusing to ` +
							`write "${path}". Inline everything into index.html.`,
					);
				}

				const written = vfs.write(path, content);
				state.writeRevision += 1;
				const bytes = Buffer.byteLength(content, "utf-8");

				log(`wrote ${written} (${Math.round(bytes / 1024)} KB)`);

				return { bytes, path: written };
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
	const reasoningEffort = env.AI_PAGE_DESIGN_REASONING;
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
				}
			: {}),
		...(modelNeedsToolImageRelocation(params.model)
			? { gateway: { order: ["novita"] } }
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
			// The provider order also prefers Novita (set in providerOptions
			// above): same price, ~1.5s TTFT vs Moonshot's 6s+ launch congestion
			// (Moonshot stays as fallback).
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
}
