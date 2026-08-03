import {
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
} from "@nestjs/common";
import {
	type AiChatBillingErrorData,
	type AiChatMessageMetadata,
	type AiChatMessageUsage,
	type AiChatRequestMetadata,
	type AnimateImageInput,
	type AnimateImageOutput,
	type ApplyElementOpsInput,
	type ApplyElementOpsOutput,
	type AskUserInput,
	type AskUserOutput,
	aiChatBillingErrorDataSchema,
	animateImageInputSchema,
	applyElementOpsInputSchema,
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
	type ReadElementsInput,
	type ReadElementsOutput,
	type ReadSectionOutput,
	type ReadSkillInput,
	type ReadThemeInput,
	type ReadThemeOutput,
	type ReplaceSectionInput,
	type ReplaceSectionOutput,
	readElementsInputSchema,
	readSectionInputSchema,
	readSkillInputSchema,
	readThemeInputSchema,
	replaceSectionInputSchema,
	type ScrapeLeadsInput,
	type ScrapeLeadsOutput,
	scrapeLeadsInputSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/nestjs";
import {
	createAgentUIStream,
	createUIMessageStream,
	type InferUIMessageChunk,
	InvalidToolInputError,
	type LanguageModelUsage,
	pipeUIMessageStreamToResponse,
	smoothStream,
} from "ai";
import type { FastifyReply } from "fastify";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
// Value imports (not `import type`): Nest needs the classes at runtime for @Inject.
import { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { MarketingAssetsRepository } from "../../../marketing-assets/infrastructure/persistence/marketing-assets.repository";
import {
	type McpChatToolsResult,
	McpChatToolsService,
} from "../../../mcp-connectors/application/services/mcp-chat-tools.service";
import { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import { gatewayGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import {
	type CapturedGeneration,
	gatewayGenerationId,
	MeteringStateConflictError,
} from "../../../metering/domain/metering";
import {
	type MeteredTokenUsage,
	ModelPriceUnavailableError,
} from "../../../metering/domain/model-pricing";
import { operationPricing } from "../../../metering/domain/operation-registry";
import { PageEditsService } from "../../../pages/application/services/page-edits.service";
import { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import { annotateUserFileParts } from "../../agent/annotate-file-parts";
import { createChatAgent, type WanditUIMessage } from "../../agent/chat-agent";
import {
	estimateAiChatTokenUsage,
	projectCreationMeteringKey,
	projectCreationReservationAttemptRef,
	projectCreationStreamClaimAttemptRef,
} from "../../agent/chat-metering";
import {
	buildChatRequestContext,
	resolveVideoRequestKeySeed,
} from "../../agent/request-context";
import type { AvailableImage } from "../../agent/tools/animate-image.tool";
import { resolveBuilderModelOption } from "../../agent/tools/builder-model-options";

const MAX_IN_FLIGHT_STREAMS_PER_USER = 3;
const AI_CHAT_GENERATION_CAPTURE_ATTEMPTS = 3;
const AI_CHAT_MAX_STREAM_DURATION_MS = 35 * 60 * 1_000;

export type PreparedAiChatStream = {
	readonly eventId: string | null;
	readonly release: () => void;
};

@Injectable()
export class AiChatService {
	private readonly logger = new Logger(AiChatService.name);
	private readonly inFlightStreamsByUser = new Map<string, number>();

	constructor(
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
		@Inject(PageEditsService)
		private readonly pageEditsService: PageEditsService,
		@Inject(LeadScrapesRepository)
		private readonly leadScrapesRepository: LeadScrapesRepository,
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
		@Inject(MarketingAssetsRepository)
		private readonly marketingAssetsRepository: MarketingAssetsRepository,
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
		@Inject(McpChatToolsService)
		private readonly mcpChatToolsService: McpChatToolsService,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(ModelPricingService)
		private readonly modelPricingService: ModelPricingService,
	) {}

	async prepareStream(options: {
		chatId: string;
		messages: WanditUIMessage[];
		projectId: string;
		requestId?: string;
		scope: ProjectScope;
	}): Promise<PreparedAiChatStream> {
		const subject = meteringSubjectFrom(options.scope);
		// Concurrency is per ACTOR, not per payer: one org member streaming must
		// not block another member's slot.
		const release = this.acquireStreamSlot(options.scope.userId);

		try {
			const modelBoundMessages = annotateUserFileParts(
				elideRetiredToolOutputs(completeDanglingToolCalls(options.messages)),
			);
			const messageId = findFinalUserMessage(options.messages)?.id ?? null;
			const requestId =
				options.requestId ?? options.messages.at(-1)?.id ?? messageId;

			if (!requestId || !messageId) {
				throw new Error("AI chat reservation requires a stable request id");
			}

			try {
				const creationEvent =
					await this.meteringService.claimBundledReservation({
						chatId: options.chatId,
						claimAttemptRef: projectCreationStreamClaimAttemptRef(
							options.projectId,
							requestId,
						),
						expectedAttemptRef: projectCreationReservationAttemptRef(
							options.projectId,
						),
						idempotencyKey: projectCreationMeteringKey(options.projectId),
						messageId,
						operation: "chat",
						subject,
					});

				if (creationEvent) {
					return { eventId: creationEvent.id, release };
				}
			} catch (error) {
				if (error instanceof MeteringStateConflictError) {
					throw this.chatReplayConflict();
				}

				throw error;
			}

			const operationKey = `ai-chat:${options.chatId}:${requestId}`;

			if (env.GENERATION_BILLING_MODE === "off") {
				// The kill switch suppresses new holds only. A hold accepted before a
				// config change remains an at-most-once provider admission boundary.
				const existing = await this.meteringService.findByIdempotencyKey(
					operationKey,
					subject,
				);

				if (existing) {
					throw this.chatReplayConflict();
				}

				return { eventId: null, release };
			}

			const estimate = await this.estimateReservation(modelBoundMessages);

			let reservation: Awaited<
				ReturnType<MeteringService["reserveWithReplay"]>
			>;

			try {
				reservation = await this.meteringService.reserveWithReplay(
					"chat",
					subject,
					{
						chatId: options.chatId,
						credits: estimate.credits,
						estimatedCostUsdMicros: estimate.costUsdMicros,
						idempotencyKey: operationKey,
						messageId,
						model: env.AI_CHAT_MODEL,
					},
				);
			} catch (error) {
				if (error instanceof MeteringStateConflictError) {
					throw this.chatReplayConflict();
				}

				throw error;
			}

			if (reservation.replay !== "none") {
				throw this.chatReplayConflict();
			}

			return { eventId: reservation.event.id, release };
		} catch (error) {
			release();
			throw error;
		}
	}

	private chatReplayConflict(): ConflictException {
		return new ConflictException({
			code: "AI_CHAT_OPERATION_REPLAYED",
			message: "This AI chat operation was already accepted",
		});
	}

	async stream(options: {
		abortSignal: AbortSignal;
		chatId: string;
		messages: WanditUIMessage[];
		metadata?: AiChatRequestMetadata;
		origin?: string;
		prepared: PreparedAiChatStream;
		projectId: string;
		reply: FastifyReply;
		requestCountryCode?: string | null;
		scope: ProjectScope;
	}): Promise<void> {
		const {
			abortSignal: clientAbortSignal,
			chatId,
			messages,
			metadata,
			origin,
			prepared,
			projectId,
			reply,
			requestCountryCode,
			scope,
		} = options;
		// The acting member: upload ownership, MCP connections, and stream slots
		// are actor-scoped even when the org pool pays.
		const userId = scope.userId;
		const subject = meteringSubjectFrom(scope);
		const abortSignal = AbortSignal.any([
			clientAbortSignal,
			AbortSignal.timeout(AI_CHAT_MAX_STREAM_DURATION_MS),
		]);
		const releaseStream = this.releaseOnAbort(abortSignal, prepared.release);
		const mcpResultPromise = this.mcpChatToolsService.resolveToolsForUser(
			subject,
			prepared.eventId ?? undefined,
		);
		let resolvedMcpResult: McpChatToolsResult | undefined;
		const pendingGatewayErrorCaptures = new Map<string, Promise<void>>();
		const queueGatewayErrorCapture = (error: unknown): void => {
			if (!prepared.eventId) {
				return;
			}

			const capture = gatewayGenerationCaptureFromError(error);
			const generationId = capture
				? gatewayGenerationId(capture.providerMetadata)
				: null;

			if (
				!capture ||
				!generationId ||
				pendingGatewayErrorCaptures.has(generationId)
			) {
				return;
			}

			const capturePromise = this.captureGeneration(
				prepared.eventId,
				capture,
			).catch((captureError) => {
				// The provider error remains the stream's authority. Capture already
				// retried three times; report persistence failure without replacing it.
				this.logger.error(
					`Failed to capture AI chat gateway error ${generationId}`,
					captureError instanceof Error
						? captureError.stack
						: String(captureError),
				);
			});
			pendingGatewayErrorCaptures.set(generationId, capturePromise);
		};
		const flushGatewayErrorCaptures = async (): Promise<void> => {
			await Promise.all(pendingGatewayErrorCaptures.values());
		};

		try {
			// Per-request context and connector discovery are independent. Start
			// both together so zero-connection users add no wall-clock wait.
			const [manualEdits, mcpResult] = await Promise.all([
				this.pagesRepository.collectManualEditTrail(projectId),
				mcpResultPromise,
			]);
			resolvedMcpResult = mcpResult;
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
				workspace:
					scope.kind === "org"
						? { actorCanManage: scope.actorIsLimitExempt }
						: null,
			});
			const mcpNoticeBlock =
				mcpResult.notices.length > 0
					? `MCP connector notices:\n${mcpResult.notices
							.map((notice) => `- ${notice}`)
							.join("\n")}`
					: null;
			const contextWithMcpNotices = [context, mcpNoticeBlock]
				.filter((block): block is string => Boolean(block))
				.join("\n\n");
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
					imageGenerationsRepository: this.imageGenerationsRepository,
					leadScrapesRepository: this.leadScrapesRepository,
					marketingAssetsRepository: this.marketingAssetsRepository,
					mediaGenerationsRepository: this.mediaGenerationsRepository,
					meteringService: this.meteringService,
					pageEditsService: this.pageEditsService,
					pagesRepository: this.pagesRepository,
					parentEventId: prepared.eventId ?? undefined,
					projectId,
					// Snapshotted into generation specs for later model swapping; no
					// generator reads it yet.
					quality: metadata?.composer?.quality,
					requireSelectedSource: metadata?.composer?.mode === "video",
					requestKeySeed,
					requestCountryCode: requestCountryCode ?? null,
					selectedSourceImage,
					subject,
					userId,
				},
				contextWithMcpNotices || null,
				mcpResult.tools,
				mcpResult.approvalMap,
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
			let finalUsage: LanguageModelUsage | null = null;
			const pendingGenerationCaptures: CapturedGeneration[] = [];
			const stepUsages: MeteredTokenUsage[] = [];
			const stream = createUIMessageStream<WanditUIMessage>({
				execute: async ({ writer }) => {
					let wroteBillingError = false;
					const writeBillingError = (error: unknown): boolean => {
						const data = this.billingErrorData(error);

						if (!data) {
							return false;
						}

						if (!wroteBillingError) {
							wroteBillingError = true;
							writer.write({ type: "data-billing-error", data });
						}

						return true;
					};
					// The agent stream sees provider/tool failures first. Expected 402s
					// become a typed data part; other failures keep the existing capture-
					// once behavior and generic client message.
					const onAgentStreamError = (error: unknown): string => {
						queueGatewayErrorCapture(error);

						if (writeBillingError(error)) {
							return "Insufficient credits.";
						}

						return this.handleStreamError(error, {
							chatId,
							projectId,
							userId,
						});
					};

					try {
						const stopOnBillingError = ({
							stopStream,
						}: {
							stopStream: () => void;
						}) =>
							new TransformStream({
								transform: (part, controller) => {
									if (
										part.type === "tool-error" &&
										writeBillingError(part.error)
									) {
										// AI SDK v7 normally converts a thrown tool error into
										// model-visible text and continues the tool loop. Billing
										// refusals are terminal: emit the typed UI part above,
										// suppress the tool-error chunk, and prevent another step.
										stopStream();
										return;
									}

									controller.enqueue(part);
								},
							});
						const agentStream = await createAgentUIStream({
							abortSignal,
							agent,
							// Models emit text in sentence-sized bursts, which renders as
							// "snapping" blocks. smoothStream re-slices the deltas into
							// words with a small delay so the UI reads like typing.
							// Word chunking splits on whitespace — fine for FR/AR alike.
							experimental_transform: [
								stopOnBillingError,
								smoothStream({ delayInMs: 15 }),
							],
							messageMetadata: ({
								part,
							}): AiChatMessageMetadata | undefined => {
								if (part.type === "start") {
									return { model: env.AI_CHAT_MODEL };
								}

								if (part.type === "finish") {
									finalUsage = part.totalUsage;
									return {
										model: env.AI_CHAT_MODEL,
										usage: toAiChatMessageUsage(part.totalUsage),
									};
								}

								return undefined;
							},
							onError: onAgentStreamError,
							onEnd: async () => {
								await flushGatewayErrorCaptures();

								if (!prepared.eventId) {
									return;
								}

								for (const capture of pendingGenerationCaptures) {
									await this.captureGeneration(prepared.eventId, capture);
								}

								const usage =
									finalUsage ?? aggregateMeteredTokenUsage(stepUsages);

								if (!usage) {
									return;
								}

								try {
									await this.meteringService.settle(prepared.eventId, {
										modelId: env.AI_CHAT_MODEL,
										pricing: "token",
										rawUsage: finalUsage ?? stepUsages,
										usage,
									});
								} catch (error) {
									if (!writeBillingError(error)) {
										throw error;
									}
								}
							},
							onStepEnd: async (step) => {
								stepUsages.push(step.usage);

								if (prepared.eventId) {
									const capture = {
										providerMetadata: step.providerMetadata,
										stepUsage: step.usage,
									};

									try {
										await this.captureGeneration(prepared.eventId, capture);
									} catch {
										// AI SDK intentionally swallows onStepEnd callback errors.
										// Retain the exact capture and retry it in onEnd before the
										// event can settle, rather than silently losing this step.
										pendingGenerationCaptures.push(capture);
									}
								}
							},
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
					} catch (error) {
						queueGatewayErrorCapture(error);
						await flushGatewayErrorCaptures();

						if (writeBillingError(error)) {
							return;
						}

						// Setup failures never reach the agent stream's onError —
						// capture here, then rethrow so the SDK still emits an error
						// chunk for the client.
						Sentry.captureException(error, {
							tags: { chatId, projectId, userId },
						});
						throw error;
					}
				},
				onError: (error: unknown) => {
					queueGatewayErrorCapture(error);
					return this.streamErrorMessage(error);
				},
				onEnd: async ({ isContinuation, responseMessage }) => {
					try {
						await flushGatewayErrorCaptures();

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
					} finally {
						try {
							await mcpResult.close();
						} finally {
							releaseStream();
						}
					}
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
		} catch (error) {
			queueGatewayErrorCapture(error);
			await flushGatewayErrorCaptures();

			// The controller hijacked the reply before calling us, so the global
			// exception filter sees reply.sent and skips — capture here or lose it.
			Sentry.captureException(error, { tags: { chatId, projectId, userId } });
			const mcpResult =
				resolvedMcpResult ?? (await mcpResultPromise.catch(() => undefined));
			try {
				await mcpResult?.close();
			} finally {
				releaseStream();
			}
			throw error;
		}
	}

	private acquireStreamSlot(userId: string): () => void {
		const active = this.inFlightStreamsByUser.get(userId) ?? 0;

		if (active >= MAX_IN_FLIGHT_STREAMS_PER_USER) {
			throw new HttpException(
				{
					code: "RATE_LIMITED",
					message: `At most ${MAX_IN_FLIGHT_STREAMS_PER_USER} AI streams may run at once`,
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		this.inFlightStreamsByUser.set(userId, active + 1);
		let released = false;

		return () => {
			if (released) {
				return;
			}

			released = true;
			const current = this.inFlightStreamsByUser.get(userId) ?? 0;

			if (current <= 1) {
				this.inFlightStreamsByUser.delete(userId);
				return;
			}

			this.inFlightStreamsByUser.set(userId, current - 1);
		};
	}

	private releaseOnAbort(
		abortSignal: AbortSignal,
		release: () => void,
	): () => void {
		const releaseAndDetach = () => {
			abortSignal.removeEventListener("abort", releaseAndDetach);
			release();
		};

		if (abortSignal.aborted) {
			releaseAndDetach();
		} else {
			abortSignal.addEventListener("abort", releaseAndDetach, { once: true });
		}

		return releaseAndDetach;
	}

	private async captureGeneration(
		eventId: string,
		capture: CapturedGeneration,
	): Promise<void> {
		let lastError: unknown;

		for (
			let attempt = 1;
			attempt <= AI_CHAT_GENERATION_CAPTURE_ATTEMPTS;
			attempt += 1
		) {
			try {
				const generationRef = await this.meteringService.captureGeneration(
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

		Sentry.captureException(lastError, {
			tags: { eventId, meteringPhase: "capture_generation" },
		});
		throw lastError;
	}

	private async estimateReservation(
		modelBoundMessages: readonly WanditUIMessage[],
	): Promise<{ costUsdMicros: number | null; credits: number }> {
		try {
			const quote = await this.modelPricingService.quoteTokenUsage(
				env.AI_CHAT_MODEL,
				estimateAiChatTokenUsage(modelBoundMessages),
			);

			return {
				costUsdMicros: quote.costUsdMicros,
				credits: Math.max(
					operationPricing("chat").reserveFloorCredits,
					quote.credits,
				),
			};
		} catch (error) {
			if (!(error instanceof ModelPriceUnavailableError)) {
				throw error;
			}

			this.logger.warn(
				`Chat pricing unavailable for ${env.AI_CHAT_MODEL}; reserving the registry floor`,
			);

			return {
				costUsdMicros: null,
				credits: operationPricing("chat").reserveFloorCredits,
			};
		}
	}

	private billingErrorData(error: unknown): AiChatBillingErrorData | null {
		if (!(error instanceof HttpException)) {
			return null;
		}

		const status = error.getStatus();
		const response = error.getResponse();
		const details =
			typeof response === "object" && response !== null && "details" in response
				? response.details
				: null;
		const responseCode =
			typeof response === "object" && response !== null && "code" in response
				? response.code
				: null;

		// Two expected billing refusals become typed parts: out-of-credits
		// (402) and the org member's monthly cap (403, distinct code — buying
		// credits is not the fix, raising the limit is).
		const candidate =
			status === 402
				? { code: "INSUFFICIENT_CREDITS", details, statusCode: 402 }
				: status === 403 && responseCode === "MEMBER_CREDIT_LIMIT_REACHED"
					? { code: "MEMBER_CREDIT_LIMIT_REACHED", details, statusCode: 403 }
					: null;

		if (!candidate) {
			return null;
		}

		const parsed = aiChatBillingErrorDataSchema.safeParse(candidate);

		return parsed.success ? parsed.data : null;
	}

	private handleStreamError(
		error: unknown,
		context: { chatId: string; projectId: string; userId: string },
	): string {
		// Stream onError never reaches any exception filter — capture explicitly.
		Sentry.captureException(error, { tags: context });
		this.logger.error("AI chat stream failed", error);

		return this.streamErrorMessage(error);
	}

	/** User-facing message only — no capture, no log (see capture-once note). */
	private streamErrorMessage(error: unknown): string {
		return InvalidToolInputError.isInstance(error)
			? error.message
			: "An error occurred.";
	}
}

function toAiChatMessageUsage(usage: LanguageModelUsage): AiChatMessageUsage {
	return {
		inputTokens: usage.inputTokens,
		inputTokenDetails: {
			cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
			cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
			noCacheTokens: usage.inputTokenDetails.noCacheTokens,
		},
		outputTokens: usage.outputTokens,
		outputTokenDetails: {
			reasoningTokens: usage.outputTokenDetails.reasoningTokens,
			textTokens: usage.outputTokenDetails.textTokens,
		},
		totalTokens: usage.totalTokens,
	};
}

function aggregateMeteredTokenUsage(
	usages: readonly MeteredTokenUsage[],
): MeteredTokenUsage | null {
	if (usages.length === 0) {
		return null;
	}

	const inputTokens = usages.reduce(
		(total, usage) => total + (usage.inputTokens ?? 0),
		0,
	);
	const outputTokens = usages.reduce(
		(total, usage) => total + (usage.outputTokens ?? 0),
		0,
	);
	const cacheReadTokens = usages.reduce(
		(total, usage) => total + (usage.inputTokenDetails?.cacheReadTokens ?? 0),
		0,
	);
	const cacheWriteTokens = usages.reduce(
		(total, usage) => total + (usage.inputTokenDetails?.cacheWriteTokens ?? 0),
		0,
	);

	return {
		inputTokenDetails: { cacheReadTokens, cacheWriteTokens },
		inputTokens,
		outputTokens,
	};
}

const DISMISSED_ASK_USER_OUTPUT: AskUserOutput = {
	dismissed: true,
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

// The mutation may or may not have landed before the abort. The model must
// inspect the current page instead of blindly replaying the batch.
const INTERRUPTED_APPLY_ELEMENT_OPS_OUTPUT: ApplyElementOpsOutput = {
	message:
		"The targeted edit was interrupted mid-stream — it may or may not have " +
		"been applied. Read the affected elements or theme before retrying.",
	status: "rejected",
};

const INCOMPLETE_APPLY_ELEMENT_OPS_INPUT: ApplyElementOpsInput = {
	ops: [
		{
			kind: "text",
			value: "The requested text was lost when the tool input was interrupted.",
			wid: "unknown",
		},
	],
};

const INTERRUPTED_READ_ELEMENTS_OUTPUT: ReadElementsOutput = {
	message:
		"The element read was interrupted before it finished — call " +
		"read_elements again if the elements are still needed.",
	status: "no-page",
};

const INCOMPLETE_READ_ELEMENTS_INPUT: ReadElementsInput = {
	wids: ["unknown"],
};

const INTERRUPTED_READ_THEME_OUTPUT: ReadThemeOutput = {
	message:
		"The theme read was interrupted before it finished — call read_theme " +
		"again if the current tokens are still needed.",
	status: "no-page",
};

const INCOMPLETE_READ_THEME_INPUT: ReadThemeInput = {};

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
 * onEnd. Dynamic MCP tools share the generic branch below; every built-in
 * tool the agent exposes needs its own schema-valid branch because the
 * model-bound copy is re-validated inside createAgentUIStream.
 */
export function completeDanglingToolCalls(
	messages: readonly WanditUIMessage[],
): WanditUIMessage[] {
	const lastMessageIndex = messages.length - 1;

	return messages.map((message, messageIndex) => {
		if (messageIndex === lastMessageIndex) {
			return message;
		}

		let changed = false;
		const parts = message.parts.map((part) => {
			if (part.type === "dynamic-tool") {
				switch (part.state) {
					case "input-streaming":
					case "input-available":
						changed = true;

						return {
							...part,
							errorText: "Tool call was interrupted.",
							input: part.input,
							state: "output-error" as const,
						};
					case "approval-requested":
						changed = true;

						return {
							...part,
							approval: {
								approved: false as const,
								id: part.approval.id,
								reason: "interrupted",
							},
							state: "output-denied" as const,
						};
					case "approval-responded":
						changed = true;

						if (!part.approval.approved) {
							return {
								...part,
								approval: {
									...part.approval,
									approved: false as const,
								},
								state: "output-denied" as const,
							};
						}

						return {
							...part,
							approval: {
								...part.approval,
								approved: true as const,
							},
							errorText: "Tool call was interrupted.",
							state: "output-error" as const,
						};
					default:
						return part;
				}
			}

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
					output: DISMISSED_ASK_USER_OUTPUT,
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

			if (part.type === "tool-apply_element_ops") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = applyElementOpsInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_APPLY_ELEMENT_OPS_INPUT,
					output: INTERRUPTED_APPLY_ELEMENT_OPS_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-read_elements") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = readElementsInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_READ_ELEMENTS_INPUT,
					output: INTERRUPTED_READ_ELEMENTS_OUTPUT,
					state: "output-available" as const,
				};
			}

			if (part.type === "tool-read_theme") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = readThemeInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_READ_THEME_INPUT,
					output: INTERRUPTED_READ_THEME_OUTPUT,
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
