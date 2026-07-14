/**
 * The BUILD brain: a ToolLoopAgent that writes a site into a virtual file
 * system instead of answering in prose.
 *
 * Runs inside the Trigger.dev task (outside Nest), so this file must stay
 * free of NestJS imports — everything the loop needs (model, system prompt,
 * brief, ids) is passed in by the caller. Model strings resolve through the
 * AI SDK's default Vercel AI Gateway provider.
 *
 * The loop is draft → three screenshot review passes → finish. The passes
 * are enforced in code (the finish guard), not just in the prompt: the model
 * literally cannot end the build before reviewing its own rendered page.
 */
import { env } from "@wandit/env/server";
import { isStepCount, type Tool, ToolLoopAgent, tool } from "ai";
import { z } from "zod";

import {
	BUILD_IMAGE_ASPECTS,
	type BuildImageAspect,
	generateBuildImage,
	MAX_IMAGES,
} from "./generate-image";
import {
	type CapturedShot,
	createScreenshotSession,
	type ScreenshotSession,
} from "./screenshot";
import { type SiteFile, VirtualFileSystem } from "./virtual-files";

export type SiteBuildParams = {
	/** Names the screenshot temp dir and the R2 asset prefix. */
	attemptId: string;
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

// Generous but bounded: draft + three screenshot/rewrite passes + image
// generations. The accepted-finish flag is the intended exit; isStepCount is
// the runaway backstop.
const MAX_STEPS = 48;

// Full landing pages routinely exceed 30k chars of HTML; the ceiling must
// leave room for a complete write_file call in a single step.
const MAX_OUTPUT_TOKENS = 64_000;

// finish is refused until this many screenshot_page passes succeeded.
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
	screenshotPasses: number;
	summary: string | null;
};

export function createBuildLoopState(): BuildLoopState {
	return {
		finishAccepted: false,
		imageSequence: 0,
		imagesGenerated: 0,
		screenshotPasses: 0,
		summary: null,
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
	| {
			consoleErrors: string[];
			desktopShots: number;
			mobileShots: number;
			overflow: { desktop: number; mobile: number };
			pass: number;
			refused: false;
	  };

// Explicit (declaration-emit friendly) tool map; same alias-over-Record
// pattern as AiChatToolSet in chat-agent.ts.
export type BuilderTools = {
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
 * write_file, refused finish, pass counting, image budget) are code, not
 * prompt prose, and must stay verifiable without a model or a browser.
 */
export function createBuilderTools(params: BuilderToolsParams): BuilderTools {
	const { screenshots, state, vfs } = params;

	// toModelOutput must show the model images that the transcript output must
	// NOT carry — raw bytes are stashed per tool call and looked up by id.
	const shotsByCall = new Map<string, CapturedShot[]>();
	const imageByCall = new Map<string, { base64: string; mediaType: string }>();

	return {
		finish: tool({
			description:
				"Declare the site complete. Call this ONCE, only after index.html " +
				`is written AND all ${REQUIRED_SCREENSHOT_PASSES} screenshot review ` +
				"passes are done.",
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
							"index.html has not been written yet. Write the page, do the " +
							`${REQUIRED_SCREENSHOT_PASSES} screenshot review passes, then finish.`,
					};
				}

				if (state.screenshotPasses < REQUIRED_SCREENSHOT_PASSES) {
					log(
						`finish refused — ${state.screenshotPasses} of ` +
							`${REQUIRED_SCREENSHOT_PASSES} screenshot passes done`,
					);

					return {
						accepted: false as const,
						reason:
							`Only ${state.screenshotPasses} of ${REQUIRED_SCREENSHOT_PASSES} ` +
							"required screenshot review passes done. Call screenshot_page, " +
							"review, fix, then finish.",
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
				`of external image the page may use. Max ${MAX_IMAGES} images per ` +
				"build; on unavailable/failed, build CSS/SVG art for that role instead.",
			inputSchema: z.object({
				aspect: z.enum(BUILD_IMAGE_ASPECTS),
				prompt: z.string().min(20),
				role: z.string().min(1),
			}),
			execute: async ({ aspect, prompt, role }, { toolCallId }) => {
				if (state.imagesGenerated >= MAX_IMAGES) {
					return {
						message:
							`Image budget exhausted (${MAX_IMAGES} per build) — build ` +
							"CSS/SVG art instead.",
						status: "failed" as const,
					};
				}

				// One step's tool calls run CONCURRENTLY (the SDK Promise.alls
				// them), so the budget slot and the key sequence are taken
				// synchronously BEFORE the first await — parallel calls must never
				// share an R2 key or slip past MAX_IMAGES. A failure releases its
				// budget slot but keeps its sequence number, so a retry can't
				// collide with a concurrent success.
				state.imagesGenerated += 1;
				state.imageSequence += 1;
				const index = state.imageSequence;

				const result = await generateBuildImage({
					aspect,
					attemptId: params.attemptId,
					index,
					projectId: params.projectId,
					prompt,
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

				log(`re-reading ${path} to review it`);

				return { content, path };
			},
		}),
		screenshot_page: tool({
			description:
				"Render the current index.html in a real browser and SEE it: " +
				"desktop (1440px) and mobile (390px) screenshots top to bottom, " +
				"console errors, and a horizontal-overflow report. " +
				`${REQUIRED_SCREENSHOT_PASSES} passes are required before finish.`,
			inputSchema: emptyInputSchema,
			execute: async (_input, { toolCallId }) => {
				const html = vfs.read("index.html");

				if (html === null) {
					return {
						message:
							"index.html has not been written yet — write it first, then " +
							"screenshot.",
						refused: true as const,
					};
				}

				const capture = await screenshots.capture(html);

				state.screenshotPasses += 1;
				shotsByCall.set(toolCallId, capture.shots);

				const desktopShots = capture.shots.filter(
					(shot) => shot.viewport === "desktop",
				).length;
				const mobileShots = capture.shots.length - desktopShots;

				log(
					`screenshot pass ${state.screenshotPasses}/${REQUIRED_SCREENSHOT_PASSES} — ` +
						`${capture.shots.length} shots, ` +
						`${capture.consoleErrors.length} console errors`,
				);

				return {
					consoleErrors: capture.consoleErrors,
					desktopShots,
					mobileShots,
					overflow: capture.overflow,
					pass: state.screenshotPasses,
					refused: false as const,
				};
			},
			toModelOutput: ({ output, toolCallId }) => {
				if (output.refused) {
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
				const overflowText = (px: number) => (px > 1 ? `${px}px` : "none");

				return {
					type: "content",
					value: [
						{
							text:
								`Pass ${output.pass} of ${REQUIRED_SCREENSHOT_PASSES}. ` +
								`Desktop: ${output.desktopShots} shots, mobile: ` +
								`${output.mobileShots} shots. Console errors: ${errors}. ` +
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
	const state = createBuildLoopState();
	const screenshots = createScreenshotSession(params.attemptId);
	const startedAt = Date.now();

	// Read at BUILD time (not snapshotted like the model): a knob for quick
	// reasoning experiments across builder models. Every provider reads only
	// its own providerOptions key, so both are always safe to send.
	const reasoningEffort = env.AI_PAGE_DESIGN_REASONING;
	const reasoningOptions = reasoningEffort
		? {
				providerOptions: {
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
				},
			}
		: {};

	log(
		`starting build of "${params.title}" with model ${params.model}` +
			(reasoningEffort ? ` (reasoning: ${reasoningEffort})` : ""),
	);

	try {
		const agent = new ToolLoopAgent({
			instructions: params.system,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			model: params.model,
			...reasoningOptions,
			stopWhen: buildStopConditions(state),
			tools: createBuilderTools({
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

		assertValidSite(vfs);

		log(
			`build done in ${Math.round((Date.now() - startedAt) / 1000)}s — ` +
				`${steps.length} steps, ${state.screenshotPasses} screenshot passes, ` +
				`${state.imagesGenerated} images`,
		);

		return {
			files: vfs.toFiles(),
			steps: steps.length,
			summary,
		};
	} finally {
		// Browser + temp dir always go away, success or failure — the Trigger
		// worker process may be reused for the next build.
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
