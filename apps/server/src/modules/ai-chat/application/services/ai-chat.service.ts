import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	type AnimateImageInput,
	type AnimateImageOutput,
	type AskUserInput,
	type AskUserOutput,
	animateImageInputSchema,
	askUserInputSchema,
	type GenerateImageInput,
	type GenerateImageOutput,
	type GenerateMarketingAssetInput,
	type GenerateMarketingAssetOutput,
	type GeneratePageInput,
	type GeneratePageOutput,
	type GetDirectionCandidatesInput,
	type GetDirectionCandidatesOutput,
	type GetPageOutlineOutput,
	generateImageInputSchema,
	generateMarketingAssetInputSchema,
	generatePageInputSchema,
	getDirectionCandidatesInputSchema,
	IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES,
	type ReadSectionOutput,
	type ReadSkillInput,
	type ReplaceSectionInput,
	type ReplaceSectionOutput,
	readSectionInputSchema,
	readSkillInputSchema,
	replaceSectionInputSchema,
	type ScrapeLeadsInput,
	type ScrapeLeadsOutput,
	scrapeLeadsInputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	createAgentUIStream,
	createUIMessageStream,
	type InferUIMessageChunk,
	InvalidToolInputError,
	pipeUIMessageStreamToResponse,
	smoothStream,
} from "ai";
import type { FastifyReply } from "fastify";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
// Value imports (not `import type`): Nest needs the classes at runtime for @Inject.
import { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { MarketingAssetsRepository } from "../../../marketing-assets/infrastructure/persistence/marketing-assets.repository";
import { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { PageEditsService } from "../../../pages/application/services/page-edits.service";
import { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { annotateUserFileParts } from "../../agent/annotate-file-parts";
import { createChatAgent, type WanditUIMessage } from "../../agent/chat-agent";
import {
	buildChatRequestContext,
	resolveVideoRequestKeySeed,
} from "../../agent/request-context";
import type { AvailableImage } from "../../agent/tools/animate-image.tool";
import { resolveBuilderModelOption } from "../../agent/tools/builder-model-options";
import type { AiChatRequestMetadata } from "../../presentation/http/controllers/ai-chat.controller";

@Injectable()
export class AiChatService {
	private readonly logger = new Logger(AiChatService.name);

	constructor(
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
		@Inject(PageEditsService)
		private readonly pageEditsService: PageEditsService,
		@Inject(LeadScrapesRepository)
		private readonly leadScrapesRepository: LeadScrapesRepository,
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
		@Inject(MarketingAssetsRepository)
		private readonly marketingAssetsRepository: MarketingAssetsRepository,
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
	) {}

	async stream(options: {
		abortSignal: AbortSignal;
		chatId: string;
		messages: WanditUIMessage[];
		metadata?: AiChatRequestMetadata;
		origin?: string;
		projectId: string;
		reply: FastifyReply;
		requestCountryCode?: string | null;
		userId: string;
	}): Promise<void> {
		const {
			abortSignal,
			chatId,
			messages,
			metadata,
			origin,
			projectId,
			reply,
			requestCountryCode,
			userId,
		} = options;
		// Per-request context: prompt-box settings, preview selection, and the
		// wids the user manually edited since the last AI change (so the model
		// never clobbers intentional edits).
		const manualEdits =
			await this.pagesRepository.collectManualEditTrail(projectId);
		const availableImages = collectAvailableImages(messages);
		const selectedSourceImage = resolveSelectedSourceImage(
			metadata,
			availableImages,
			userId,
		);
		// A transport retry appends a new user message id, but the retained Video
		// draft carries the same browser UUID. Prefer that validated token so the
		// original DB attempt and Trigger.dev idempotency key are reused.
		const requestKeySeed = resolveVideoRequestKeySeed(
			metadata,
			findFinalUserMessage(messages)?.id,
		);
		const context = buildChatRequestContext({
			manualEdits,
			metadata,
			requestCountryCode,
			selectedSourceImage,
		});
		// Per-request agent: generate_page, scrape_leads, and the page-edit
		// tools need to know which project/chat they act for (see chat-agent.ts).
		const agent = createChatAgent(
			{
				availableImages,
				// Composer's model picker: per-message builder override, validated
				// against the allow-list; undefined = env default.
				builderModel: resolveBuilderModelOption(
					metadata?.composer?.options?.builderModel,
				),
				chatId,
				generationPolicyService: this.generationPolicyService,
				imageGenerationsRepository: this.imageGenerationsRepository,
				leadScrapesRepository: this.leadScrapesRepository,
				marketingAssetsRepository: this.marketingAssetsRepository,
				mediaGenerationsRepository: this.mediaGenerationsRepository,
				pageEditsService: this.pageEditsService,
				pagesRepository: this.pagesRepository,
				projectId,
				// Snapshotted into generation specs for later model swapping; no
				// generator reads it yet.
				quality: metadata?.composer?.quality,
				requireSelectedSource: metadata?.composer?.mode === "video",
				requestKeySeed,
				requestCountryCode: requestCountryCode ?? null,
				selectedSourceImage,
				userId,
			},
			context,
		);
		// Three transforms on the MODEL-BOUND copy only (DB + UI keep the truth):
		// 1. complete tool calls that never got a result (typed-past ask_user,
		//    or a stream aborted mid-execute) — providers reject a history that
		//    carries a tool call without a matching result,
		// 2. elide outputs from the retired read_skill tool so large stale
		//    guidance does not cost tokens on every request,
		// 3. follow user file parts with a text marker exposing their URL —
		//    without it the model sees the image but cannot reference it in
		//    generate_image/animate_image and asks for an already-sent photo.
		const agentMessages = annotateUserFileParts(
			elideRetiredToolOutputs(completeDanglingToolCalls(messages)),
		);
		const onError = (error: unknown) => this.handleStreamError(error);

		// TODO(billing): gate like GenerationPolicyService before public launch
		const stream = createUIMessageStream<WanditUIMessage>({
			execute: async ({ writer }) => {
				const agentStream = await createAgentUIStream({
					abortSignal,
					agent,
					// Models emit text in sentence-sized bursts, which renders as
					// "snapping" blocks. smoothStream re-slices the deltas into
					// words with a small delay so the UI reads like typing.
					// Word chunking splits on whitespace — fine for FR/AR alike.
					experimental_transform: smoothStream({ delayInMs: 15 }),
					onError,
					uiMessages: agentMessages,
				});
				// The live agent's tool set is a strict SUBSET of WanditUIMessage's
				// (read_skill exists only in retired history), so its chunks are
				// valid WanditUIMessage chunks — TS can't see through the generics.
				writer.merge(
					agentStream as unknown as ReadableStream<
						InferUIMessageChunk<WanditUIMessage>
					>,
				);
			},
			onError,
			onEnd: async ({ isContinuation, responseMessage }) => {
				// A tray answer CONTINUES the previous assistant message: the SDK
				// keeps its id and hands back the original row extended with the
				// answer + everything the model did after it. The insert-if-absent
				// below would hit the id conflict and silently drop all of that,
				// so continuations overwrite the existing row instead.
				if (isContinuation) {
					await this.chatsRepository.upsertUiMessage(chatId, {
						...responseMessage,
						role: "assistant" as const,
					});

					return;
				}

				const finalUserMessage = findFinalUserMessage(messages);
				const messagesToInsert = [
					...(finalUserMessage
						? [{ ...finalUserMessage, role: "user" as const }]
						: []),
					...(responseMessage.parts.length > 0
						? [{ ...responseMessage, role: "assistant" as const }]
						: []),
				];

				// Save only the new request/response rows; never replace prior history.
				await this.chatsRepository.insertUiMessagesIfAbsent(
					chatId,
					messagesToInsert,
				);
			},
			originalMessages: messages,
		});

		pipeUIMessageStreamToResponse({
			headers:
				origin === env.CORS_ORIGIN
					? {
							"Access-Control-Allow-Credentials": "true",
							"Access-Control-Allow-Origin": origin,
							Vary: "Origin",
						}
					: undefined,
			response: reply.raw,
			stream,
		});
	}

	private handleStreamError(error: unknown): string {
		this.logger.error("AI chat stream failed", error);

		return InvalidToolInputError.isInstance(error)
			? error.message
			: "An error occurred.";
	}
}

const SKIPPED_ASK_USER_OUTPUT: AskUserOutput = {
	label: "User answered in chat instead of selecting an option",
	selectedId: "__skipped__",
};

const INCOMPLETE_ASK_USER_INPUT: AskUserInput = {
	options: [
		{ id: "__incomplete_1", label: "Incomplete option 1" },
		{ id: "__incomplete_2", label: "Incomplete option 2" },
	],
	question: "The previous question did not finish streaming.",
};

// generate_page aborted mid-execute (the user closed the tab while it was
// queueing): a schema-valid "unavailable" answer the model can act on.
const INTERRUPTED_GENERATE_PAGE_OUTPUT: GeneratePageOutput = {
	message:
		"The build request was interrupted before it could be queued. If the " +
		"user still wants the page, call generate_page again with the brief.",
	status: "unavailable",
};

// Only used when the INPUT itself never finished streaming, so the real
// brief is unrecoverable. Must pass the schema's brief .min(50).
const INCOMPLETE_GENERATE_PAGE_INPUT: GeneratePageInput = {
	brief:
		"The build request did not finish streaming before the connection " +
		"dropped, so the original brief was lost. Recompose it from the " +
		"conversation if the user still wants the page.",
	title: "Interrupted build request",
};

// scrape_leads aborted mid-execute (the user closed the tab while it was
// queueing): a schema-valid "unavailable" answer the model can act on.
const INTERRUPTED_SCRAPE_LEADS_OUTPUT: ScrapeLeadsOutput = {
	message:
		"The lead scrape request was interrupted before it could be queued. If " +
		"the user still wants the lead list, call scrape_leads again.",
	status: "unavailable",
};

// Only used when the INPUT itself never finished streaming, so the real
// query is unrecoverable.
const INCOMPLETE_SCRAPE_LEADS_INPUT: ScrapeLeadsInput = {
	query: "unknown",
};

// generate_marketing_asset aborted mid-execute: a schema-valid "unavailable"
// answer the model can act on.
const INTERRUPTED_GENERATE_MARKETING_ASSET_OUTPUT: GenerateMarketingAssetOutput =
	{
		message:
			"The marketing request was interrupted before it could be queued. If " +
			"the user still wants the deliverable, call generate_marketing_asset " +
			"again with the brief.",
		status: "unavailable",
	};

// Only used when the INPUT itself never finished streaming, so the real
// brief is unrecoverable. Must pass the schema's brief .min(30).
const INCOMPLETE_GENERATE_MARKETING_ASSET_INPUT: GenerateMarketingAssetInput = {
	assetType: "html-asset",
	brief:
		"The marketing brief did not finish streaming before the connection " +
		"dropped. Recompose it from the conversation if still wanted.",
	title: "Interrupted marketing request",
};

const INTERRUPTED_GENERATE_IMAGE_OUTPUT: GenerateImageOutput = {
	message:
		"The image request was interrupted before it could be queued. If the " +
		"user still wants the images, call generate_image again.",
	status: "unavailable",
};

const INCOMPLETE_GENERATE_IMAGE_INPUT: GenerateImageInput = {
	aspect: "1:1",
	count: 1,
	prompt: "The image prompt was lost when the request stream was interrupted.",
	sourceImageUrls: [],
	title: "Interrupted image request",
};

const INTERRUPTED_ANIMATE_IMAGE_OUTPUT: AnimateImageOutput = {
	message:
		"The image animation request was interrupted before it could be queued. " +
		"If the user still wants it, call animate_image again with their attachment.",
	status: "unavailable",
};

const INCOMPLETE_ANIMATE_IMAGE_INPUT: AnimateImageInput = {
	aspect: "16:9",
	motion: "balanced",
	prompt:
		"The motion direction was lost when the request stream was interrupted.",
	sourceImageUrl: "https://invalid.local/interrupted-image.jpg",
	sourceMediaType: "image/jpeg",
};

const INTERRUPTED_READ_SKILL_MARKDOWN =
	"[skill load was interrupted — call read_skill again if needed]";

// The menu never arrived — the model must re-roll, never invent directions.
const INTERRUPTED_GET_DIRECTION_CANDIDATES_OUTPUT: GetDirectionCandidatesOutput =
	{
		candidates:
			"[the candidate menu was interrupted before it arrived — call " +
			"get_direction_candidates again before composing a brief]",
	};

const INCOMPLETE_GET_DIRECTION_CANDIDATES_INPUT: GetDirectionCandidatesInput = {
	business: "unknown",
};

// "no-page" is the only non-ok status the schema allows; the message keeps
// the model from concluding the page is actually gone.
const INTERRUPTED_GET_PAGE_OUTLINE_OUTPUT: GetPageOutlineOutput = {
	message:
		"The outline read was interrupted before it finished — call " +
		"get_page_outline again if the outline is still needed.",
	status: "no-page",
};

const INTERRUPTED_READ_SECTION_MESSAGE =
	"The section read was interrupted before it finished — call read_section " +
	"again if the section is still needed.";

// The mutation may or may not have landed before the abort — say so instead
// of guessing, and point the model at the cheap way to find out.
const INTERRUPTED_REPLACE_SECTION_OUTPUT: ReplaceSectionOutput = {
	message:
		"The edit was interrupted mid-stream — it may or may not have been " +
		"applied. Call get_page_outline to check the current version before " +
		"retrying.",
	status: "rejected",
};

// Only used when the INPUT itself never finished streaming. Passes the
// schema's html .min(20); wid matches widSchema.
const INCOMPLETE_REPLACE_SECTION_INPUT: ReplaceSectionInput = {
	html: "<!-- the replacement HTML did not finish streaming -->",
	wid: "unknown",
};

/**
 * A later message means these calls never got a result: the user typed past
 * an ask_user, or the stream was aborted (tab closed) while a server tool
 * was still executing. History MUST NOT carry a tool call without a result —
 * providers answer 400 to that, which would brick the chat on every turn.
 * Complete them for the model without mutating the transcript persisted by
 * onEnd. EVERY tool the agent exposes needs a branch here (a new tool
 * without one re-opens the bricked-chat bug); each branch fills schema-valid
 * input AND output, because the model-bound copy is re-validated inside
 * createAgentUIStream.
 */
function completeDanglingToolCalls(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	const lastMessageIndex = messages.length - 1;

	return messages.map((message, messageIndex) => {
		if (messageIndex === lastMessageIndex) {
			return message;
		}

		let changed = false;
		const parts = message.parts.map((part) => {
			if (part.type === "tool-ask_user") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = askUserInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_ASK_USER_INPUT,
					output: SKIPPED_ASK_USER_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-read_skill") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = readSkillInputSchema.safeParse(part.input);
				// The output echoes the skill slug, so keep input and output
				// telling the same story even when the input never arrived.
				const input: ReadSkillInput = parsedInput.success
					? parsedInput.data
					: { skill: "landing-page-design" };

				return {
					...part,
					input,
					output: {
						markdown: INTERRUPTED_READ_SKILL_MARKDOWN,
						skill: input.skill,
					},
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-generate_page") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = generatePageInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_GENERATE_PAGE_INPUT,
					output: INTERRUPTED_GENERATE_PAGE_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-scrape_leads") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = scrapeLeadsInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_SCRAPE_LEADS_INPUT,
					output: INTERRUPTED_SCRAPE_LEADS_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-animate_image") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = animateImageInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_ANIMATE_IMAGE_INPUT,
					output: INTERRUPTED_ANIMATE_IMAGE_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-generate_marketing_asset") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = generateMarketingAssetInputSchema.safeParse(
					part.input,
				);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_GENERATE_MARKETING_ASSET_INPUT,
					output: INTERRUPTED_GENERATE_MARKETING_ASSET_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-generate_image") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = generateImageInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_GENERATE_IMAGE_INPUT,
					output: INTERRUPTED_GENERATE_IMAGE_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-get_direction_candidates") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = getDirectionCandidatesInputSchema.safeParse(
					part.input,
				);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_GET_DIRECTION_CANDIDATES_INPUT,
					output: INTERRUPTED_GET_DIRECTION_CANDIDATES_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-get_page_outline") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				return {
					...part,
					input: {},
					output: INTERRUPTED_GET_PAGE_OUTLINE_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-read_section") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = readSectionInputSchema.safeParse(part.input);
				const input = parsedInput.success
					? parsedInput.data
					: { wid: "unknown" };
				const output: ReadSectionOutput = {
					message: INTERRUPTED_READ_SECTION_MESSAGE,
					status: "no-page",
					wid: input.wid,
				};

				return {
					...part,
					input,
					output,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-replace_section") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = replaceSectionInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_REPLACE_SECTION_INPUT,
					output: INTERRUPTED_REPLACE_SECTION_OUTPUT,
					state: "output-available" as const,
				};
			}

			return part;
		});

		return changed ? { ...message, parts } : message;
	});
}

const SKILL_ELIDED_PLACEHOLDER =
	"[skill content elided from history — call read_skill again if needed]";

/**
 * The model re-reads the whole history on every request. Blank large outputs
 * from retired tools out of PRIOR messages: old skill markdown wastes tokens.
 * Direction menus are NOT elided — the Brain must keep seeing the candidates
 * it already sampled and chose from. The persisted transcript stays untouched.
 */
function elideRetiredToolOutputs(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	const lastMessageIndex = messages.length - 1;

	return messages.map((message, messageIndex) => {
		if (messageIndex === lastMessageIndex) {
			return message;
		}

		let changed = false;
		const parts = message.parts.map((part) => {
			if (
				part.type === "tool-read_skill" &&
				part.state === "output-available"
			) {
				changed = true;

				return {
					...part,
					output: { ...part.output, markdown: SKILL_ELIDED_PLACEHOLDER },
				};
			}

			return part;
		});

		return changed ? { ...message, parts } : message;
	});
}

function findFinalUserMessage(
	messages: readonly WanditUIMessage[],
): WanditUIMessage | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];

		if (message?.role === "user") {
			return message;
		}
	}

	return undefined;
}

const IMAGE_TO_VIDEO_MEDIA_TYPE_SET = new Set<string>(
	IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES,
);

/**
 * The tool's source allowlist is derived from validated transcript parts,
 * not from model input. Include ask_user attachment answers because those
 * live on an assistant tool part rather than a user file part.
 */
function collectAvailableImages(
	messages: readonly WanditUIMessage[],
): AvailableImage[] {
	const images = new Map<string, AvailableImage>();

	const add = (url: string, mediaType: string) => {
		if (!IMAGE_TO_VIDEO_MEDIA_TYPE_SET.has(mediaType)) {
			return;
		}

		images.set(url, {
			mediaType:
				mediaType as (typeof IMAGE_TO_VIDEO_SOURCE_MEDIA_TYPES)[number],
			url,
		});
	};

	for (const message of messages) {
		for (const part of message.parts) {
			if (message.role === "user" && part.type === "file") {
				add(part.url, part.mediaType);
				continue;
			}

			if (part.type === "tool-ask_user" && part.state === "output-available") {
				for (const file of part.output.files ?? []) {
					add(file.url, file.mediaType);
				}
			}
		}
	}

	return [...images.values()];
}

/**
 * The dashboard's dedicated source picker records its exact uploaded URL in
 * server-validated composer metadata. Resolve that marker only against an
 * eligible transcript file owned by this user, then close the tool over it so
 * another context attachment cannot be substituted by the model.
 */
function resolveSelectedSourceImage(
	metadata: AiChatRequestMetadata | undefined,
	availableImages: readonly AvailableImage[],
	userId: string,
): AvailableImage | undefined {
	if (metadata?.composer?.mode !== "video") {
		return undefined;
	}

	const sourceImageUrl = metadata.composer.options?.sourceImageUrl;
	const sourceMediaType = metadata.composer.options?.sourceMediaType;

	if (
		typeof sourceImageUrl !== "string" ||
		typeof sourceMediaType !== "string"
	) {
		return undefined;
	}

	const selected = availableImages.find(
		(image) =>
			image.url === sourceImageUrl && image.mediaType === sourceMediaType,
	);

	return selected && isUserUploadUrl(selected.url, userId)
		? selected
		: undefined;
}
