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
 * finish. Successful writes and edits count as their own source review.
 */

import {
	MAX_SOURCE_IMAGES_PER_GENERATION,
	PAGE_TOKEN_NAMES,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	isStepCount,
	type LanguageModelUsage,
	type Tool,
	ToolLoopAgent,
	tool,
} from "ai";
import * as cheerio from "cheerio";
import { z } from "zod";
import {
	createLlmModel,
	gatewayRoutingForModel,
	withLlmAttribution,
} from "../../../ai-provider/domain/llm-provider";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { resolveVideoGenerationPlan } from "../../../media-generations/domain/video-quality-models";
import {
	type MeasuredOperationReservation,
	measuredDirectSettlement,
	measuredReserveCredits,
	reservationTermsFromEvent,
} from "../../../metering/application/services/fixed-operation-billing";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import type { MeasuredCostEstimateInput } from "../../../metering/application/services/model-pricing.service";
import {
	fixedGenerationStepUsage,
	type GatewayGenerationMetadata,
	hasGatewayGenerationMetadata,
} from "../../../metering/domain/gateway-metering";
import { ensureDocumentTitle } from "../../../pages/domain/document-title";
import { inlineKnownCdnScripts } from "../../../pages/domain/inline-cdn-scripts";
import { optimizeFontLoading } from "../../../pages/domain/optimize-font-loading";
import { optimizeImageMarkup } from "../../../pages/domain/optimize-image-markup";
// Plain module (no Nest), safe in the Trigger bundle — cheerio bundles fine.
import {
	isStampableContainer,
	isStampableLeaf,
	stampHtml,
} from "../../../pages/domain/stamp";
import { BUILDER_REASONING_EFFORT_BY_MODEL } from "../tools/builder-model-options";
import { extractBriefUserPhotoUrls } from "./brief-user-photos";
import type { BuildProgressEvent } from "./build-progress";
import { composeBuildStartMessages } from "./build-start-messages";
import {
	BUILD_IMAGE_ASPECTS,
	type BuildImageAspect,
	generateBuildImage,
	MAX_IMAGES,
} from "./generate-image";
import {
	type BuildVideoAspect,
	generateBuildVideo,
	IMAGE_VIDEO_DURATION_SECONDS,
	MAX_VIDEOS,
	VIDEO_ASPECTS,
	videoCostEstimateInput,
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
	/** Present only while billing enforcement is enabled. */
	meteringService?: MeteringService;
	/** Live-progress sink (chat card via run metadata). Best-effort. */
	onEvent?: (event: BuildProgressEvent) => void;
	/** Failed Gateway call evidence, emitted before the provider error escapes. */
	onGenerationError?: (error: unknown) => Promise<void> | void;
	/** Durable per-step metering sink; awaited before the next agent step. */
	onStepEnd?: (step: SiteBuildMeteringStep) => Promise<void> | void;
	/** Selects the validation contract for the generated landing page. */
	pageKind?: "cod" | "website";
	/** Generated images upload under this project's R2 prefix. */
	projectId: string;
	/** System prompt snapshotted at queue time — see builder-prompt.ts. */
	system: string;
	title: string;
	/** Parent page-build event for direct image/video child operations. */
	usageEventId?: string;
	/** Payer + acting member for metering and gateway attribution. */
	subject: MeteringSubject;
};

export type SiteBuildMeteringStep = {
	model: { modelId: string; provider: string };
	providerMetadata: unknown;
	usage: LanguageModelUsage;
};

export type SiteBuildResult = {
	files: SiteFile[];
	/** How many agent steps the build took (dashboard visibility only). */
	steps: number;
	/** Builder description, or the deterministic step-budget fallback. */
	summary: string | null;
	/** Aggregate language-model tokens consumed across every builder step. */
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
};

// Generous but bounded: one build pass + image generations + rendered review
// and correction. The accepted-finish flag is the intended exit; isStepCount
// is the runaway backstop (unused steps cost nothing).
const MAX_STEPS = 64;

// Full landing pages routinely exceed 30k chars of HTML; the ceiling must
// leave room for a complete write_file call in a single step.
const MAX_OUTPUT_TOKENS = 64_000;

// Two rendered review passes minimum — one correctness/structure hunt, one
// design-quality hunt. Counted only on successful captures. Once both passes
// are recorded, targeted edits are reviewed through edit_file's returned
// context and may finish without another screenshot; passes 3-4 are optional
// for risky or structural changes the builder needs to see rendered. Exported
// for tests. (3 originally; tuned through 1 and 5 during the 2026-07-26
// experiments — 2 is the speed/quality compromise.)
export const REQUIRED_SCREENSHOT_PASSES = 2;

/** Hard visual-review budget. Successful captures alone consume a pass. */
export const MAX_SCREENSHOT_PASSES = 4;

const MAX_FAILED_EDIT_ATTEMPTS = 5;
const EDIT_CONTEXT_LINES = 8;
const STEP_BUDGET_SUMMARY =
	"Build reached its step budget; publishing the last valid revision.";
const EARLY_STOP_SUMMARY =
	"The builder ended without an explicit finish; publishing the last valid revision.";

export function fallbackBuildSummary(stepCount: number): string {
	return stepCount >= MAX_STEPS ? STEP_BUDGET_SUMMARY : EARLY_STOP_SUMMARY;
}

export function resolveBuilderReasoningEffort(model: string) {
	const configuredReasoningEffort =
		BUILDER_REASONING_EFFORT_BY_MODEL[model] ?? env.AI_PAGE_DESIGN_REASONING;

	if (configuredReasoningEffort === "auto") {
		return undefined;
	}

	return configuredReasoningEffort;
}

/**
 * Mutable loop state shared between the tools and the stop condition. A
 * plain object (not closure variables) so the guards are unit-testable.
 */
export type BuildLoopState = {
	/** All failed edit_file calls across the build; successful edits do not reset it. */
	failedEditAttempts: number;
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
		failedEditAttempts: 0,
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
	meteringService?: MeteringService;
	onEvent?: (event: BuildProgressEvent) => void;
	pageKind?: "cod" | "website";
	projectId: string;
	screenshots: ScreenshotSession;
	state: BuildLoopState;
	subject: MeteringSubject;
	usageEventId?: string;
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
			/** Intrinsic pixels of the stored object; absent on older parts. */
			height?: number;
			role: string;
			status: "generated";
			url: string;
			width?: number;
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

type EditFileOutput = {
	bytes: number;
	context: string;
	path: string;
	revision: number;
};

type WriteFileOutput = {
	bytes: number;
	path: string;
	unchanged?: true;
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
		EditFileOutput
	>;
	finish: Tool<{ summary: string }, FinishOutput>;
	generate_image: Tool<
		{
			aspect: BuildImageAspect;
			prompt: string;
			role: string;
			sourceImageUrls?: string[];
		},
		GenerateImageOutput
	>;
	list_files: Tool<
		EmptyInput,
		{ files: Array<{ bytes: number; path: string }> }
	>;
	read_file: Tool<{ path: string }, { content: string; path: string }>;
	screenshot_page: Tool<EmptyInput, ScreenshotPageOutput>;
	write_file: Tool<{ content: string; path: string }, WriteFileOutput>;
};

function createEditContext(
	content: string,
	matchStart: number,
	replaceLength: number,
): string {
	const lines = content.split("\n");
	const startLine = content.slice(0, matchStart).split("\n").length;
	const endOffset =
		replaceLength > 0 ? matchStart + replaceLength - 1 : matchStart;
	const endLine = content.slice(0, endOffset).split("\n").length;
	const contextStartLine = Math.max(1, startLine - EDIT_CONTEXT_LINES);
	const contextEndLine = Math.min(lines.length, endLine + EDIT_CONTEXT_LINES);
	const context = lines.slice(contextStartLine - 1, contextEndLine).join("\n");

	return (
		`Lines ${contextStartLine}-${contextEndLine} of index.html after the edit:` +
		`\n${context}`
	);
}

/**
 * The builder's tool set. Exported for tests: the guards (single-file
 * write_file, refused finish, image/video budgets) are code, not prompt
 * prose, and must stay verifiable without a model.
 */
export function createBuilderTools(params: BuilderToolsParams): BuilderTools {
	const { pageKind = "website", screenshots, state, vfs } = params;

	// toModelOutput must show the model images that the transcript output must
	// NOT carry — raw bytes are stashed per tool call and looked up by id.
	const imageByCall = new Map<string, { base64: string; mediaType: string }>();
	const shotsByCall = new Map<string, CapturedShot[]>();
	let screenshotPassesInFlight = 0;

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
				"background video. User uploads may be JPEG, PNG, or WebP; the " +
				"platform automatically repairs source format, size, and aspect where " +
				"possible, but refuses images beyond 1:4–4:1 or over 25 MB, and very " +
				"small photos can animate softly. Use it ONLY when subtle motion " +
				"genuinely elevates a section — a hero atmosphere, a fabric drift — never by " +
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
				const plan = resolveVideoGenerationPlan({
					durationSeconds: IMAGE_VIDEO_DURATION_SECONDS,
					kind: "i2v",
					multiShot: false,
					narration: false,
					quality: "standard",
					talking: false,
				});
				const childReservation =
					params.meteringService && params.usageEventId
						? await reserveMeasuredChild(params.meteringService, "video", {
								attemptRef: `${params.attemptId}:video:${index}`,
								estimate: videoCostEstimateInput({
									audio: false,
									durationSeconds: IMAGE_VIDEO_DURATION_SECONDS,
									modelId: plan.modelId,
								}),
								idempotencyKey: `page-build-video:${params.usageEventId}:${index}`,
								model: plan.modelId,
								parentEventId: params.usageEventId,
								subject: params.subject,
							})
						: null;
				const childEvent = childReservation?.event ?? null;
				let generationCapturedBeforeDelivery = false;

				const result = await generateBuildVideo({
					...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
					aspect,
					attemptId: params.attemptId,
					imageUrl,
					index,
					modelId: plan.modelId,
					metering: {
						operation: "video",
						organizationId: params.subject.organizationId ?? null,
						userId: params.subject.actorUserId,
					},
					motionPrompt,
					...(childEvent && params.meteringService
						? {
								onProviderGeneration: async (
									generation: GatewayGenerationMetadata,
								) => {
									await captureRequiredGeneration(
										params.meteringService as MeteringService,
										childEvent.id,
										{
											providerMetadata: generation.providerMetadata,
											stepUsage: fixedGenerationStepUsage(generation.usage, 1),
										},
									);
									generationCapturedBeforeDelivery = true;
								},
							}
						: {}),
					projectId: params.projectId,
					voiceControl: false,
				});

				if (result.status !== "generated") {
					state.videosGenerated -= 1;
					if (childReservation && childEvent && params.meteringService) {
						if (hasGatewayGenerationMetadata(result)) {
							const providerUnits =
								"providerUnits" in result && result.providerUnits === 1 ? 1 : 0;
							if (!generationCapturedBeforeDelivery) {
								await captureRequiredGeneration(
									params.meteringService,
									childEvent.id,
									{
										providerMetadata: result.providerMetadata,
										stepUsage: fixedGenerationStepUsage(
											result.usage,
											providerUnits,
											providerUnits === 0 ? "refunded_failure" : undefined,
										),
									},
								);
							}
							await params.meteringService.settle(childEvent.id, {
								...measuredDirectSettlement(childReservation.reservation, {
									completedUnits: providerUnits,
								}),
								model: result.model,
								rawUsage: result.usage ?? null,
							});
						} else {
							await params.meteringService.refund(
								childEvent.id,
								"page_build_video_failed",
							);
						}
					}
					log(`animate_image ${result.status}: ${result.message}`);

					return { message: result.message, status: result.status };
				}

				if (childReservation && childEvent && params.meteringService) {
					if (!generationCapturedBeforeDelivery) {
						await captureRequiredGeneration(
							params.meteringService,
							childEvent.id,
							{
								providerMetadata: result.providerMetadata,
								stepUsage: fixedGenerationStepUsage(result.usage, 1),
							},
						);
					}
					await params.meteringService.settle(childEvent.id, {
						...measuredDirectSettlement(childReservation.reservation),
						model: result.model,
						rawUsage: result.usage ?? null,
					});
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
				try {
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
						const trimEndMatches = findWholeLineMatches(
							current,
							search,
							(line) => line.trimEnd(),
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
					// Batched edit_file calls in one step serialize only because this
					// execute body has zero awaits before the write. Adding one above
					// breaks the promised in-order semantics.
					const written = vfs.write("index.html", content);
					state.failedEditRepeats = 0;
					state.lastFailedEditSearch = null;
					state.writeRevision += 1;
					state.reviewedRevision = state.writeRevision;
					const bytes = Buffer.byteLength(content, "utf-8");
					const context = createEditContext(
						content,
						matchStart,
						replace.length,
					);
					emitEvent({
						bytes,
						html: content,
						kind: "edit",
						type: "page-written",
					});
					const delta =
						Buffer.byteLength(replace, "utf-8") -
						Buffer.byteLength(matched, "utf-8");

					log(
						`edited ${written} (${delta >= 0 ? "+" : ""}${delta} bytes → ` +
							`${Math.round(bytes / 1024)} KB, revision ${state.writeRevision})`,
					);

					return {
						bytes,
						context,
						path: written,
						revision: state.writeRevision,
					};
				} catch (error) {
					state.failedEditAttempts += 1;

					if (state.failedEditAttempts >= MAX_FAILED_EDIT_ATTEMPTS) {
						throw new Error(
							"stop snippet-editing; rewrite the affected section with " +
								"write_file, or screenshot and finish.",
						);
					}

					throw error;
				}
			},
		}),
		finish: tool({
			description:
				"Declare the site complete. Call this ONCE, only after the " +
				"required screenshot_page review (minimum " +
				`${REQUIRED_SCREENSHOT_PASSES} per build). After those passes, ` +
				"edit_file's updated surrounding context reviews each targeted " +
				"fix, so finish directly unless a risky or structural change needs " +
				"an optional third or fourth rendered review.",
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

				assertValidSite(vfs, pageKind);

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
				// real photos instead of inventing the product. No zod maximum: the
				// first MAX_SOURCE_IMAGES_PER_GENERATION are kept below.
				sourceImageUrls: z
					.array(z.url())
					.optional()
					.describe(
						"Exact user photo URLs from the brief, at most " +
							`${MAX_SOURCE_IMAGES_PER_GENERATION}.`,
					),
			}),
			execute: async (
				{ aspect, prompt, role, sourceImageUrls: requestedSourceImageUrls },
				{ toolCallId },
			): Promise<GenerateImageOutput> => {
				// Keep the first MAX_SOURCE_IMAGES_PER_GENERATION distinct sources:
				// the edit model takes no more, and a rejected call would cost the
				// builder a step.
				const sourceImageUrls = [
					...new Set(requestedSourceImageUrls ?? []),
				].slice(0, MAX_SOURCE_IMAGES_PER_GENERATION);
				const requestedSourceCount = requestedSourceImageUrls?.length ?? 0;

				if (sourceImageUrls.length < requestedSourceCount) {
					log(
						`generate_image (${role}): kept ${sourceImageUrls.length} of ` +
							`${requestedSourceCount} source photos`,
					);
				}

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
				const imageModel =
					sourceImageUrls.length > 0 && env.AI_IMAGE_EDIT_MODEL
						? env.AI_IMAGE_EDIT_MODEL
						: (env.AI_IMAGE_MODEL ?? null);
				const childReservation =
					params.meteringService && params.usageEventId
						? await reserveMeasuredChild(params.meteringService, "image", {
								attemptRef: `${params.attemptId}:image:${index}`,
								estimate: imageModel
									? { count: 1, kind: "image", modelId: imageModel }
									: null,
								idempotencyKey: `page-build-image:${params.usageEventId}:${index}`,
								model: imageModel,
								parentEventId: params.usageEventId,
								subject: params.subject,
							})
						: null;
				const childEvent = childReservation?.event ?? null;
				let generationCapturedBeforeDelivery = false;

				const result = await generateBuildImage({
					...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
					aspect,
					attemptId: params.attemptId,
					index,
					metering: {
						operation: "image",
						organizationId: params.subject.organizationId ?? null,
						userId: params.subject.actorUserId,
					},
					...(childEvent && params.meteringService
						? {
								onProviderGeneration: async (
									generation: GatewayGenerationMetadata,
								) => {
									await captureRequiredGeneration(
										params.meteringService as MeteringService,
										childEvent.id,
										{
											providerMetadata: generation.providerMetadata,
											stepUsage: fixedGenerationStepUsage(generation.usage, 1),
										},
									);
									generationCapturedBeforeDelivery = true;
								},
							}
						: {}),
					projectId: params.projectId,
					prompt,
					...(sourceImageUrls.length > 0 ? { sourceImageUrls } : {}),
				});

				if (result.status !== "generated") {
					state.imagesGenerated -= 1;
					if (childReservation && childEvent && params.meteringService) {
						if (hasGatewayGenerationMetadata(result)) {
							const providerUnits =
								"providerUnits" in result && result.providerUnits === 1 ? 1 : 0;
							if (!generationCapturedBeforeDelivery) {
								await captureRequiredGeneration(
									params.meteringService,
									childEvent.id,
									{
										providerMetadata: result.providerMetadata,
										stepUsage: fixedGenerationStepUsage(
											result.usage,
											providerUnits,
											providerUnits === 0 ? "refunded_failure" : undefined,
										),
									},
								);
							}
							await params.meteringService.settle(childEvent.id, {
								...measuredDirectSettlement(childReservation.reservation, {
									completedUnits: providerUnits,
								}),
								model: result.model,
								rawUsage: result.usage ?? null,
							});
						} else {
							await params.meteringService.refund(
								childEvent.id,
								"page_build_image_failed",
							);
						}
					}
					log(`generate_image ${result.status}: ${result.message}`);

					return { message: result.message, status: result.status };
				}

				if (childReservation && childEvent && params.meteringService) {
					if (!generationCapturedBeforeDelivery) {
						await captureRequiredGeneration(
							params.meteringService,
							childEvent.id,
							{
								providerMetadata: result.providerMetadata,
								stepUsage: fixedGenerationStepUsage(result.usage, 1),
							},
						);
					}
					await params.meteringService.settle(childEvent.id, {
						...measuredDirectSettlement(childReservation.reservation),
						model: result.model,
						rawUsage: result.usage ?? null,
					});
				}

				imageByCall.set(toolCallId, {
					base64: result.imageBase64,
					mediaType: result.mediaType,
				});
				log(`generated image ${index}/${MAX_IMAGES} (${role}) → ${result.url}`);
				emitEvent({ role, type: "image-generated", url: result.url });

				return {
					aspect,
					// Real stored pixels, so the model can write width/height
					// attributes that match the object instead of guessing.
					height: result.height,
					role,
					status: "generated" as const,
					url: result.url,
					width: result.width,
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
				// Real stored pixels when this part carries them (parts persisted
				// before dimensions existed do not).
				const pixels =
					output.width && output.height
						? `, ${output.width}x${output.height}px — use those pixels as the img width/height attributes`
						: "";

				return {
					type: "content",
					value: [
						{
							text:
								`Generated (${output.role}, ${output.aspect}${pixels}): ` +
								`${output.url} — judge whether it fits the design before ` +
								"placing it.",
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
				"Read back one file only when you genuinely lost track of its " +
				"current contents. write_file is source-reviewed automatically, " +
				"and edit_file already returns updated surrounding context.",
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
				`build, maximum ${MAX_SCREENSHOT_PASSES}). Returns desktop ` +
				"(1440×900) and mobile (390×844) " +
				"screenshots from top to bottom, console/page errors, failed " +
				"asset requests, and horizontal-overflow measurements. After the " +
				"two required passes, use a third or fourth only for risky or " +
				"structural changes that need another rendered review.",
			inputSchema: emptyInputSchema,
			execute: async (_input, { toolCallId }) => {
				if (
					state.screenshotPasses + screenshotPassesInFlight >=
					MAX_SCREENSHOT_PASSES
				) {
					return {
						message:
							`screenshot budget exhausted (${MAX_SCREENSHOT_PASSES} per ` +
							"build) — finish now with the current page",
						refused: true as const,
					};
				}

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
				screenshotPassesInFlight += 1;

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
							"edit_file's returned context for targeted changes.",
						refused: false as const,
						unavailable: true as const,
					};
				} finally {
					screenshotPassesInFlight -= 1;
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
				"do not call read_file solely because you wrote it. Resubmitting " +
				"byte-identical content is reported unchanged and does not create " +
				"a new revision.",
			inputSchema: z.object({
				content: z.string().min(1),
				path: z.string().min(1).describe('Relative path, e.g. "index.html".'),
			}),
			execute: async ({ content, path }) => {
				// The one-file contract is enforced here, not just in the prompt:
				// the preview cannot serve sibling assets, so any other path is
				// rejected before it ever lands in the VFS.
				assertMutationAllowed(state, path, "write");

				const current = vfs.read("index.html");

				if (current === content) {
					log(
						"write_file unchanged — index.html is byte-identical; " +
							`revision ${state.writeRevision} retained`,
					);

					return {
						bytes: Buffer.byteLength(content, "utf-8"),
						path: "index.html",
						unchanged: true as const,
					};
				}

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

/**
 * Inline Builder media child: one measured hold sized by the local catalog
 * estimate (floor when none), settled provisionally from the same estimate
 * and repriced by gateway reconciliation.
 */
async function reserveMeasuredChild(
	meteringService: MeteringService,
	operation: "image" | "video",
	input: {
		attemptRef: string;
		estimate: MeasuredCostEstimateInput | null;
		idempotencyKey: string;
		model: string | null;
		parentEventId: string;
		subject: MeteringSubject;
	},
): Promise<{
	event: Awaited<ReturnType<MeteringService["reserve"]>>;
	reservation: MeasuredOperationReservation;
}> {
	const quote = input.estimate
		? await meteringService.estimateMeasuredCost(input.estimate)
		: null;
	const estimatedCostUsdMicros = quote?.costUsdMicros ?? null;
	const event = await meteringService.reserve(operation, input.subject, {
		attemptRef: input.attemptRef,
		credits: measuredReserveCredits(
			operation,
			1,
			estimatedCostUsdMicros,
			meteringService.usdMicrosPerCredit,
		),
		estimatedCostUsdMicros,
		idempotencyKey: input.idempotencyKey,
		measuredTerms: { estimatedUnitUsdMicros: estimatedCostUsdMicros, units: 1 },
		model: input.model,
		parentEventId: input.parentEventId,
	});

	return {
		event,
		reservation: {
			credits: event.reservedCredits,
			eventId: event.id,
			operation,
			referenceId: input.attemptRef,
			replay: "none",
			terms: reservationTermsFromEvent(event),
			units: 1,
		},
	};
}

async function captureRequiredGeneration(
	meteringService: MeteringService,
	eventId: string,
	capture: Parameters<MeteringService["captureGeneration"]>[1],
): Promise<void> {
	let lastError: unknown;

	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const generationRef = await meteringService.captureGeneration(
				eventId,
				capture,
			);

			if (!generationRef) {
				throw new Error("AI Gateway generation id is missing");
			}

			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
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

	// Read at BUILD time (not snapshotted like the model): per-model overrides
	// win over the env knob, and "auto" defers to the provider. Gateway
	// attribution is merged with (and preserves) model-specific routing.
	const reasoningEffort = resolveBuilderReasoningEffort(params.model);
	const buildMeteringContext = {
		operation: "page_build" as const,
		organizationId: params.subject.organizationId ?? null,
		userId: params.subject.actorUserId,
	};
	// The same routing preference feeds gateway.order (Vercel providerOptions
	// below) and OpenRouter's provider.order model setting.
	const routingOrder = params.model.startsWith("moonshotai/kimi-k2")
		? ["novita"]
		: params.model.startsWith("alibaba/")
			? ["fireworks"]
			: undefined;
	const providerOptions = withLlmAttribution(
		{
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
			// preference stays scoped to K2-era models. Qwen's default routing
			// lands on Alibaba Cloud/Together at ~55 tps; Fireworks serves the
			// same models at ~330 tps (gateway P50 chart, 2026-07-26).
			// An openai/* builder (luna in prod) is pinned to OpenAI itself — see
			// gatewayRoutingForModel. The two knobs never overlap: the pin covers
			// openai/* models, the order preferences cover Kimi/Qwen.
			gateway: {
				...gatewayRoutingForModel(params.model),
				...(routingOrder ? { order: routingOrder } : {}),
			},
		},
		buildMeteringContext,
		"page_build",
	);

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
			model: createLlmModel(params.model, {
				context: buildMeteringContext,
				reasoningEffort,
				routingOrder,
				task: "page_build",
			}),
			...(params.onStepEnd ? { onStepEnd: params.onStepEnd } : {}),
			providerOptions,
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
				...(params.meteringService
					? { meteringService: params.meteringService }
					: {}),
				...(params.onEvent ? { onEvent: params.onEvent } : {}),
				pageKind: params.pageKind ?? "website",
				projectId: params.projectId,
				screenshots,
				state,
				...(params.usageEventId ? { usageEventId: params.usageEventId } : {}),
				subject: params.subject,
				vfs,
			}),
		});

		// stream(), NOT generate(): a non-streaming call buffers the entire
		// generation server-side before sending response headers, and a full-page
		// write step routinely exceeds Node's 5-minute undici headersTimeout
		// (observed as GatewayTimeoutError 408). Streaming receives headers
		// immediately; nothing here consumes deltas — the stream is just drained.
		const userPhotoUrls = screenshotRequired
			? extractBriefUserPhotoUrls(params.brief)
			: [];
		const stream =
			userPhotoUrls.length > 0
				? await agent.stream({
						abortSignal: params.abortSignal,
						messages: composeBuildStartMessages({
							brief: params.brief,
							title: params.title,
							userPhotoUrls,
						}),
					})
				: await agent.stream({
						abortSignal: params.abortSignal,
						prompt:
							`Build the landing page now.\n\nTITLE: ${params.title}\n\n` +
							`BRIEF:\n${params.brief}`,
					});

		// Model-call failures don't throw while draining: the SDK enqueues them
		// as {type:"error"} stream parts (consumeStream's onError only fires
		// when reading itself fails). Capture the first cause for diagnostics,
		// but still attempt the best-effort publish path below: once a valid page
		// exists, a late provider failure must not discard it.
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

		const steps = await Promise.resolve(stream.steps).catch((error) => {
			streamError ??= error;

			return [];
		});

		if (streamError !== undefined) {
			try {
				await params.onGenerationError?.(streamError);
			} catch (captureError) {
				// Generation capture has its own durable retry path. Never replace the
				// provider failure that the attempt row and Trigger run must retain.
				log(
					`failed to buffer gateway error evidence: ${
						captureError instanceof Error
							? captureError.message
							: String(captureError)
					}`,
				);
			}

			log(
				"stream ended with an error; evaluating the last page revision — " +
					(streamError instanceof Error
						? streamError.message
						: String(streamError)),
			);
		}

		const usage = steps.reduce(
			(total, step) => ({
				inputTokens: total.inputTokens + (step.usage?.inputTokens ?? 0),
				outputTokens: total.outputTokens + (step.usage?.outputTokens ?? 0),
				totalTokens: total.totalTokens + (step.usage?.totalTokens ?? 0),
			}),
			{ inputTokens: 0, outputTokens: 0, totalTokens: 0 },
		);
		log(
			`usage: in=${usage.inputTokens} out=${usage.outputTokens} ` +
				`total=${usage.totalTokens} steps=${steps.length}`,
		);
		const reachedStepBudget = steps.length >= MAX_STEPS;
		const summary = state.finishAccepted
			? state.summary
			: fallbackBuildSummary(steps.length);

		// Deterministic stamping pass (spec §4): every editable leaf gets a
		// stable data-wid before upload, so every version's canonical HTML in
		// R2 is fully stamped. The model is never asked to do this itself.
		// The sanctioned GSAP CDN tags are inlined first, so the canonical HTML
		// never depends on a third-party CDN request. The font stylesheet links
		// are then hoisted above the inline <style>, so the browser starts the
		// render-blocking font request in the first bytes of <head> instead of
		// after 20-40 KB of CSS. The <img> markup is then normalized to one
		// prioritized LCP image and lazy everything else — srcset stays out of
		// drafts, because the editor's swap path strips it and building one
		// costs storage probes a generation must not pay for. A page that
		// forgot its <title> finally falls back to the Brain's short human
		// title, so the browser tab never reads as a URL.
		const rawHtml = vfs.read("index.html");

		if (rawHtml !== null) {
			vfs.write(
				"index.html",
				ensureDocumentTitle(
					stampHtml(
						optimizeImageMarkup(
							optimizeFontLoading(inlineKnownCdnScripts(rawHtml)),
						),
					),
					params.title,
				),
			);
		}

		try {
			assertValidSite(vfs, params.pageKind ?? "website");
		} catch (error) {
			// Name-tag for classifyBuildFailure, and keep the provider failure
			// that interrupted the build as the cause — "no index.html" because
			// the model's provider 429'd mid-write is a PROVIDER failure, and
			// replacing that evidence with a bare validation string would make
			// the chat card blame Wandit for it.
			if (error instanceof Error) {
				error.name = "PageValidationError";

				if (streamError !== undefined && error.cause === undefined) {
					error.cause = streamError;
				}
			}

			throw error;
		}

		if (!state.finishAccepted) {
			log(
				reachedStepBudget
					? "shipping best-effort page at step budget"
					: "shipping best-effort page after builder ended without an explicit finish",
			);
		}

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
			usage,
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
const JAVASCRIPT_IDENTIFIER_SOURCE = String.raw`[$A-Z_a-z][$\w]*`;
const LEAD_EVENT_LITERAL_SOURCE =
	"(?:\"wandit:lead\"|'wandit:lead'|`wandit:lead`)";
/**
 * Acknowledgement event the injected leads runtime answers with. The page's
 * success UI is gated on it, so a COD page that never names it can only ever
 * show an unacknowledged success — a plain text scan is enough, because any
 * listener (however written) must carry the literal.
 */
const LEAD_RESULT_EVENT_NAME = "wandit:lead:result";
const CUSTOM_EVENT_CONSTRUCTOR_SOURCE = String.raw`new\s+(?:(?:window|globalThis|self)\s*\.\s*)?CustomEvent\s*\(\s*`;
const NAME_AUTOCOMPLETE_TOKENS = new Set([
	"additional-name",
	"family-name",
	"given-name",
	"name",
	"nickname",
]);
const NAME_ATTRIBUTE_QUALIFIERS = new Set([
	"buyer",
	"client",
	"contact",
	"customer",
	"family",
	"first",
	"full",
	"given",
	"last",
	"recipient",
]);
const NON_PERSON_NAME_TOKENS = new Set([
	"business",
	"company",
	"file",
	"product",
	"username",
]);
const COMPACT_NAME_ATTRIBUTE_VALUES = new Set([
	"buyername",
	"clientname",
	"contactname",
	"customername",
	"familyname",
	"firstname",
	"fullname",
	"givenname",
	"lastname",
	"nomcomplet",
	"prenom",
	"recipientname",
	"surname",
]);
const NON_TEXT_NAME_INPUT_TYPES = new Set([
	"button",
	"checkbox",
	"email",
	"file",
	"hidden",
	"image",
	"number",
	"password",
	"radio",
	"reset",
	"submit",
	"tel",
]);

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Accepted zero-parser patterns, within one <script>:
 * - target.dispatchEvent(new CustomEvent("wandit:lead", ...))
 * - const event = new CustomEvent("wandit:lead", ...); dispatchEvent(event)
 *
 * Quote style, whitespace/minification, window/globalThis/self.CustomEvent,
 * and a simple const/let/var event-name literal are all tolerated. Computed
 * event names and event objects passed through helpers are intentionally not.
 */
function scriptDispatchesLeadCustomEvent(script: string): boolean {
	const eventNameArguments = new Set([LEAD_EVENT_LITERAL_SOURCE]);
	const eventNameDeclaration = new RegExp(
		String.raw`\b(?:const|let|var)\s+(${JAVASCRIPT_IDENTIFIER_SOURCE})\s*=\s*${LEAD_EVENT_LITERAL_SOURCE}`,
		"g",
	);

	for (const match of script.matchAll(eventNameDeclaration)) {
		const identifier = match[1];

		if (identifier) {
			eventNameArguments.add(`${escapeRegExp(identifier)}(?![$\\w])`);
		}
	}

	for (const eventNameArgument of eventNameArguments) {
		const customEventConstructor = `${CUSTOM_EVENT_CONSTRUCTOR_SOURCE}${eventNameArgument}`;
		const directDispatch = new RegExp(
			String.raw`\bdispatchEvent\s*\(\s*${customEventConstructor}`,
		);

		if (directDispatch.test(script)) {
			return true;
		}

		const assignedEvent = new RegExp(
			String.raw`\b(?:const|let|var)\s+(${JAVASCRIPT_IDENTIFIER_SOURCE})\s*=\s*${customEventConstructor}`,
			"g",
		);

		for (const match of script.matchAll(assignedEvent)) {
			const identifier = match[1];

			if (!identifier) {
				continue;
			}

			const followingScript = script.slice(
				(match.index ?? 0) + match[0].length,
			);
			const variableDispatch = new RegExp(
				String.raw`\bdispatchEvent\s*\(\s*${escapeRegExp(identifier)}(?![$\w])`,
			);

			if (variableDispatch.test(followingScript)) {
				return true;
			}
		}
	}

	return false;
}

function attributeIndicatesPersonName(value: string | undefined): boolean {
	if (!value) {
		return false;
	}

	const normalized = value
		.replace(/([a-z\d])([A-Z])/g, "$1 $2")
		.trim()
		.toLowerCase();

	if (normalized.includes("اسم")) {
		return true;
	}

	const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);

	if (tokens.some((token) => NON_PERSON_NAME_TOKENS.has(token))) {
		return false;
	}

	if (tokens.some((token) => COMPACT_NAME_ATTRIBUTE_VALUES.has(token))) {
		return true;
	}

	return tokens.some((token, index) => {
		if (token === "nom") {
			return true;
		}

		if (token !== "name") {
			return false;
		}

		return (
			tokens.length === 1 ||
			index === 0 ||
			NAME_ATTRIBUTE_QUALIFIERS.has(tokens[index - 1] ?? "")
		);
	});
}

function assertValidBrandMarkers(
	html: string,
	pageKind: "cod" | "website" = "website",
): void {
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
			const placementAdvice =
				pageKind === "cod" && role === "nav"
					? "keep it outside SVG/form content in the hero <header> or hero " +
						'<section> scope, or use the endorsed <a href="#order-form" ' +
						'data-brand="nav"> hero badge'
					: "keep it outside SVG/form content and inside the recognized " +
						"nav/header/footer chassis";

			throw new Error(
				`data-brand="${role}" is on <${node.tagName}>, but that wrapper ` +
					`is not stampable in this location — ${placementAdvice}`,
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

	const navMarkerIsInFooter = navMarkers.first().closest("footer").length > 0;

	if (pageKind === "cod") {
		if (!navScope.is("header, section") || navMarkerIsInFooter) {
			throw new Error(
				'data-brand="nav" must be inside the COD hero chassis, with its ' +
					"nearest section scope being <header> or <section>, and never " +
					"inside <footer>",
			);
		}
	} else if (!navScope.is("nav, header") || navMarkerIsInFooter) {
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

function assertValidSite(
	vfs: VirtualFileSystem,
	pageKind: "cod" | "website" = "website",
): void {
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

	if (pageKind === "cod") {
		const $ = cheerio.load(html);

		if ($("nav").length !== 0) {
			throw new Error(
				`COD index.html must contain zero <nav> elements (found ${$("nav").length})`,
			);
		}

		const forms = $("form");

		if (forms.length !== 1) {
			throw new Error(
				`COD index.html must contain exactly one <form> (found ${forms.length})`,
			);
		}

		const telInputs = $("input").filter(
			(_, node) => ($(node).attr("type") ?? "").trim().toLowerCase() === "tel",
		);

		if (telInputs.length === 0) {
			throw new Error(
				"COD index.html must contain at least one input[type=tel]",
			);
		}

		const nameInputs = forms
			.first()
			.find("input")
			.filter((_, node) => {
				const input = $(node);
				const type = (input.attr("type") ?? "text").trim().toLowerCase();

				if (
					input.is("[data-wandit-hp], [disabled], [readonly]") ||
					NON_TEXT_NAME_INPUT_TYPES.has(type)
				) {
					return false;
				}

				const autocomplete = (input.attr("autocomplete") ?? "")
					.trim()
					.toLowerCase()
					.split(/\s+/)
					.filter(Boolean);

				return (
					autocomplete.some((token) => NAME_AUTOCOMPLETE_TOKENS.has(token)) ||
					attributeIndicatesPersonName(input.attr("name")) ||
					attributeIndicatesPersonName(input.attr("id"))
				);
			});

		if (nameInputs.length === 0) {
			throw new Error(
				"COD index.html capture <form> must contain at least one " +
					"name-capable <input> (identified by name, id, or autocomplete)",
			);
		}

		const dispatchesLeadEvent = $("script")
			.toArray()
			.some((node) => scriptDispatchesLeadCustomEvent($(node).html() ?? ""));

		if (!dispatchesLeadEvent) {
			throw new Error(
				'COD index.html must dispatch a "wandit:lead" CustomEvent from ' +
					"a <script> element",
			);
		}

		const honeypots = $("[data-wandit-hp]");

		if (honeypots.length !== 1) {
			throw new Error(
				"COD index.html must contain exactly one data-wandit-hp " +
					`honeypot (found ${honeypots.length})`,
			);
		}

		const handlesLeadResult = $("script")
			.toArray()
			.some((node) => ($(node).html() ?? "").includes(LEAD_RESULT_EVENT_NAME));

		if (!handlesLeadResult) {
			throw new Error(
				`COD index.html must handle the "${LEAD_RESULT_EVENT_NAME}" ` +
					"acknowledgement event in a <script> element — install that " +
					"listener before dispatching the lead, and gate the final " +
					"success UI on it",
			);
		}
	}

	assertValidBrandMarkers(html, pageKind);

	// The finish tool validates BEFORE the publish-time inlining pass runs, so
	// apply the (idempotent) inliner here: the sanctioned GSAP CDN tags pass,
	// everything else external is rejected.
	const $inlined = cheerio.load(inlineKnownCdnScripts(html));
	const externalScriptUrls = $inlined("script[src]")
		.toArray()
		.map((node) => ($inlined(node).attr("src") ?? "").trim())
		.filter((src) => /^(?:https?:)?\/\//i.test(src));

	if (externalScriptUrls.length > 0) {
		throw new Error(
			`index.html loads external scripts (${externalScriptUrls.join(", ")}) — ` +
				"the published page must be self-contained, so write ALL JavaScript " +
				"inline in <script> elements; the pinned GSAP 3 core and " +
				"ScrollTrigger tags from jsdelivr/unpkg/cdnjs are auto-inlined at " +
				"finish and are the only sanctioned external scripts",
		);
	}

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
