import { createHash } from "node:crypto";
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
	ATTACHMENT_MEDIA_TYPES,
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
	type GenerateVideoInput,
	type GenerateVideoOutput,
	type GetDirectionCandidatesInput,
	type GetDirectionCandidatesOutput,
	type GetPageOutlineOutput,
	generateImageInputSchema,
	generateMarketingAssetInputSchema,
	generatePageInputSchema,
	generateVideoInputSchema,
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
import { allowedCorsWebOrigin } from "@wandit/env/cors-origins";
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
import { ConnectorGenerationsRepository } from "../../../connector-generations/infrastructure/persistence/connector-generations.repository";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { ChatsRepository } from "../../../generation/infrastructure/persistence/chats.repository";
import { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
// Value imports (not `import type`): Nest needs the classes at runtime for @Inject.
import { LeadScrapesRepository } from "../../../lead-scrapes/infrastructure/persistence/lead-scrapes.repository";
import { MarketingAssetsRepository } from "../../../marketing-assets/infrastructure/persistence/marketing-assets.repository";
import {
	type McpChatToolsResult,
	McpChatToolsService,
} from "../../../mcp-connectors/application/services/mcp-chat-tools.service";
import { VideoDirectorService } from "../../../media-generations/application/services/video-director";
import { MediaGenerationsRepository } from "../../../media-generations/infrastructure/persistence/media-generations.repository";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import { llmGenerationCaptureFromError } from "../../../metering/domain/gateway-metering";
import {
	type AiUsageEvent,
	type CapturedGeneration,
	capturedGenerationRef,
	type MeteringReserveOutcome,
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
import {
	annotateGeneratedAssets,
	generatedAssetsFromAnnotatedMessages,
} from "../../agent/annotate-generated-assets";
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
import type { AvailableDocument } from "../../agent/tools/read-attachment.tool";

const MAX_IN_FLIGHT_STREAMS_PER_USER = 3;
const AI_CHAT_GENERATION_CAPTURE_ATTEMPTS = 3;
const AI_CHAT_MAX_STREAM_DURATION_MS = 35 * 60 * 1_000;
// A refunded event's idempotency key can never be reserved again, so retries
// of a turn whose earlier attempts were voided walk "#2".."#4" key
// generations. Four crashed-and-refunded attempts of one transcript is past
// the point where letting the client keep trying helps anyone.
const AI_CHAT_TURN_KEY_GENERATIONS = 4;
// Adopting a stale hold keeps its original createdAt, the stranded recovery
// sweep refunds reserved holds older than 40 minutes by createdAt, and an
// adopted stream may itself run up to AI_CHAT_MAX_STREAM_DURATION_MS (35
// minutes) — so the hold's age at adoption plus 35 minutes must stay under
// the 40-minute sweep line or the sweep can void the hold mid-stream. That
// bounds adoption at 5 minutes; use 4 for margin. Older holds are superseded
// (refunded + re-reserved), which restarts the recovery clock.
const AI_CHAT_STALE_HOLD_ADOPTION_MAX_AGE_MS = 4 * 60_000;

export type PreparedAiChatStream = {
	readonly eventId: string | null;
	readonly release: () => void;
};

@Injectable()
export class AiChatService {
	private readonly logger = new Logger(AiChatService.name);
	private readonly inFlightStreamsByUser = new Map<string, number>();
	private readonly activeTurnKeys = new Set<string>();

	constructor(
		@Inject(ChatsRepository)
		private readonly chatsRepository: ChatsRepository,
		@Inject(ConnectorGenerationsRepository)
		private readonly connectorGenerationsRepository: ConnectorGenerationsRepository,
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
		@Inject(PageEditsService)
		private readonly pageEditsService: PageEditsService,
		@Inject(LeadScrapesRepository)
		private readonly leadScrapesRepository: LeadScrapesRepository,
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
		@Inject(VideoDirectorService)
		private readonly videoDirector: VideoDirectorService,
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
		const releaseSlot = this.acquireStreamSlot(options.scope.userId);
		let release = releaseSlot;

		try {
			const modelBoundMessages = annotateUserFileParts(
				elideRetiredToolOutputs(completeDanglingToolCalls(options.messages)),
			);
			const messageId = findFinalUserMessage(options.messages)?.id ?? null;
			const requestId =
				options.requestId ?? turnRequestId(options.messages) ?? messageId;

			if (!requestId || !messageId) {
				throw new Error("AI chat reservation requires a stable request id");
			}

			const operationKey = `ai-chat:${options.chatId}:${requestId}`;
			release = this.claimTurnKey(operationKey, releaseSlot);

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

			if (env.GENERATION_BILLING_MODE === "off") {
				// The kill switch suppresses new holds only. Holds accepted before a
				// config change remain an at-most-once provider admission boundary —
				// but only for turns that COMPLETED (settled/reconciled). A hold that
				// is merely reserved or already refunded belongs to an attempt that
				// died mid-stream (claimTurnKey above proves it is not live in this
				// process), and a retry of it must run, not 409 forever. Every key
				// generation is checked: a turn whose first hold was refunded may
				// have COMPLETED under "#2".."#4" while billing was on.
				for (
					let generation = 1;
					generation <= AI_CHAT_TURN_KEY_GENERATIONS;
					generation += 1
				) {
					const existing = await this.meteringService.findByIdempotencyKey(
						generation === 1 ? operationKey : `${operationKey}#${generation}`,
						subject,
					);

					if (!existing) {
						// Generations are minted in order — nothing beyond this one.
						break;
					}

					if (
						existing.status !== "reserved" &&
						existing.status !== "refunded"
					) {
						throw this.chatReplayConflict();
					}
				}

				return { eventId: null, release };
			}

			const estimate = await this.estimateReservation(modelBoundMessages);
			const event = await this.admitTurnReservation(subject, operationKey, {
				chatId: options.chatId,
				credits: estimate.credits,
				estimatedCostUsdMicros: estimate.costUsdMicros,
				messageId,
			});

			return { eventId: event.id, release };
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

	/**
	 * In-process liveness marker for one chat turn. While a key is claimed the
	 * turn's stream is actually running here, so a duplicate POST of the same
	 * transcript must 409 rather than adopt the running stream's reservation.
	 * Like the stream slots, this is per-process state: it cannot see another
	 * replica's streams, so cross-replica duplicates keep a small adoption
	 * race window instead of a closed one — the trade accepted throughout this
	 * service for in-memory admission state. Similarly accepted: the abort
	 * listener frees this key before the aborted stream's onEnd settle lands,
	 * so a Stop followed by an instant identical resubmit can adopt the hold
	 * and later lose its settle to the aborted attempt's partial one — the
	 * turn still delivers, and the gateway reconciliation sweep reprices the
	 * event from all captured generations. Holding the key until onEnd would
	 * close that window but leak the key (bricking the turn in-process) if
	 * onEnd ever failed to run after an abort.
	 */
	private claimTurnKey(
		operationKey: string,
		releaseSlot: () => void,
	): () => void {
		if (this.activeTurnKeys.has(operationKey)) {
			// Distinct from the replay conflict on purpose: this turn is running
			// RIGHT NOW, so the right user guidance is "wait", not "send a new
			// message" — the web pane maps this code to the busy copy.
			throw new ConflictException({
				code: "AI_CHAT_TURN_ACTIVE",
				message: "This AI chat turn is currently streaming",
			});
		}

		this.activeTurnKeys.add(operationKey);
		// Released-once guard: the abort listener and the stream's onEnd finally
		// both call release for one attempt. Without the guard the late second
		// call would delete a RETRY's freshly claimed key and reopen the
		// in-process duplicate window this marker exists to close.
		let released = false;

		return () => {
			if (released) {
				return;
			}

			released = true;
			this.activeTurnKeys.delete(operationKey);
			releaseSlot();
		};
	}

	/**
	 * Reserve the turn's hold, re-admitting retries of attempts that died
	 * mid-stream. A client retry resubmits the identical transcript, so it
	 * recomputes the identical operation key — historically that made ONE
	 * crashed attempt brick its turn behind a 409 forever. Admission now
	 * distinguishes the prior hold's state: still-reserved holds from a dead
	 * attempt are adopted outright (same event, already debited) unless they
	 * are close to the stranded-recovery refund deadline, in which case they
	 * are voided here and the next key generation takes a fresh hold; holds
	 * already refunded (their key is permanently spent) advance to the next
	 * "#n" key generation. Completed turns (settled/reconciled) remain hard
	 * 409 replays — that double-fire is what the key exists to reject.
	 */
	private async admitTurnReservation(
		subject: MeteringSubject,
		operationKey: string,
		reservation: {
			chatId: string;
			credits: number;
			estimatedCostUsdMicros: number | null;
			messageId: string;
		},
	): Promise<AiUsageEvent> {
		for (
			let generation = 1;
			generation <= AI_CHAT_TURN_KEY_GENERATIONS;
			generation += 1
		) {
			const idempotencyKey =
				generation === 1 ? operationKey : `${operationKey}#${generation}`;

			let outcome: MeteringReserveOutcome;

			try {
				outcome = await this.meteringService.reserveWithReplay(
					"chat",
					subject,
					{
						chatId: reservation.chatId,
						credits: reservation.credits,
						estimatedCostUsdMicros: reservation.estimatedCostUsdMicros,
						idempotencyKey,
						messageId: reservation.messageId,
						model: env.AI_CHAT_MODEL,
					},
				);
			} catch (error) {
				if (
					error instanceof MeteringStateConflictError &&
					error.status === "refunded"
				) {
					// This generation's hold was voided (stranded recovery or the
					// supersede below) without the turn completing — admit the retry
					// under the next generation.
					continue;
				}

				if (
					error instanceof MeteringStateConflictError &&
					error.status === "reserved"
				) {
					// Shape mismatch on a crashed hold: the retry's re-estimate no
					// longer matches what the dead attempt reserved (model pricing
					// refreshed, or AI_CHAT_MODEL changed between attempts). The
					// turn never completed and is not live in this process (the
					// turn key is ours), so void the stale hold and walk on rather
					// than reproduce the bricked-turn 409.
					await this.supersedeStaleHold(error.eventId);
					continue;
				}

				if (error instanceof MeteringStateConflictError) {
					throw this.chatReplayConflict();
				}

				throw error;
			}

			if (outcome.replay === "none") {
				return outcome.event;
			}

			if (outcome.replay === "reserved") {
				const heldForMs = Date.now() - outcome.event.createdAt.getTime();

				if (heldForMs <= AI_CHAT_STALE_HOLD_ADOPTION_MAX_AGE_MS) {
					return outcome.event;
				}

				// Too old to trust for a whole stream (see the adoption-ceiling
				// arithmetic above): void it and take a fresh hold under the next
				// generation.
				await this.supersedeStaleHold(outcome.event.id);
				continue;
			}

			throw this.chatReplayConflict();
		}

		throw this.chatReplayConflict();
	}

	/**
	 * Void a crashed attempt's hold so the next key generation can reserve
	 * fresh. refund() keeps events with durable generation refs reserved for
	 * reconciliation instead of voiding paid provider work — the fresh hold
	 * then simply coexists with the old one until the sweep prices it.
	 */
	private async supersedeStaleHold(eventId: string): Promise<void> {
		try {
			await this.meteringService.refund(eventId, "ai_chat_retry_supersede");
		} catch (error) {
			if (error instanceof MeteringStateConflictError) {
				// The hold completed (settled/reconciled) between the replay read
				// and this refund — that is a finished turn: hard replay.
				throw this.chatReplayConflict();
			}

			throw error;
		}
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

			const capture = llmGenerationCaptureFromError(error);
			const generationId = capture
				? (capturedGenerationRef(capture.providerMetadata)?.generationId ??
					null)
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
			const availableDocuments = collectAvailableDocuments(messages);
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
			// Four transforms on the MODEL-BOUND copy only (DB + UI keep the truth):
			// 1. complete tool calls that never got a result (typed-past ask_user,
			//    or a stream aborted mid-execute) — providers reject a history that
			//    carries a tool call without a matching result,
			// 2. elide outputs from the retired read_skill tool so large stale
			//    guidance does not cost tokens on every request,
			// 3. follow user file parts with a text marker exposing their URL —
			//    without it the model sees the image but cannot reference it in
			//    generate_image/animate_image and asks for an already-sent photo,
			// 4. follow settled generation tool parts with a [Generated …] marker
			//    exposing the finished asset's URL — without it the model never
			//    learns any generated URL and asks the user to re-attach media
			//    that Wandit itself produced.
			// Runs BEFORE the agent is built: generate_page receives the marker
			// URLs so a brief can never silently drop this chat's generated media.
			const agentMessages = await annotateGeneratedAssets(
				annotateUserFileParts(
					elideRetiredToolOutputs(completeDanglingToolCalls(messages)),
				),
				{
					connectorGenerationsRepository: this.connectorGenerationsRepository,
					imageGenerationsRepository: this.imageGenerationsRepository,
					mediaGenerationsRepository: this.mediaGenerationsRepository,
					projectId,
					scope,
				},
			);
			// Per-request agent: generate_page, scrape_leads, and the page-edit
			// tools need to know which project/chat they act for (see chat-agent.ts).
			const agent = createChatAgent(
				{
					availableDocuments,
					availableImages,
					conversationAssets:
						generatedAssetsFromAnnotatedMessages(agentMessages),
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
					// Only the image-animation output hard-requires a validated source
					// still. Video mode's other output (video-creator) is
					// text-to-video; a missing output means a legacy client where
					// image-animation was the only video output.
					requireSelectedSource:
						metadata?.composer?.mode === "video" &&
						(metadata.composer.output ?? "image-animation") ===
							"image-animation",
					requestKeySeed,
					requestCountryCode: requestCountryCode ?? null,
					selectedSourceImage,
					subject,
					userId,
					videoDirector: this.videoDirector,
				},
				contextWithMcpNotices || null,
				mcpResult.tools,
				mcpResult.approvalMap,
			);
			let finalUsage: LanguageModelUsage | null = null;
			const pendingGenerationCaptures: CapturedGeneration[] = [];
			const stepUsages: MeteredTokenUsage[] = [];
			const stream = createUIMessageStream<WanditUIMessage>({
				execute: async ({ writer }) => {
					let wroteBillingError = false;
					let streamErrorCaptured = false;
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
							// The SDK's synthetic second invocation (see below) must
							// not be captured for an expected refusal either.
							streamErrorCaptured = true;
							return "Insufficient credits.";
						}

						// The SDK invokes onError twice per failure: first with the
						// real error, then with a synthetic Error built from the
						// sanitized errorText while the finish wrapper replays the
						// chunk stream. Only the first carries signal — capture that
						// one and keep answering with the client-safe message.
						if (streamErrorCaptured) {
							return this.streamErrorMessage(error);
						}
						streamErrorCaptured = true;

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

			const corsOrigin = allowedCorsWebOrigin(
				origin,
				env.CORS_ORIGIN,
				env.CORS_EXTRA_ORIGINS,
			);
			pipeUIMessageStreamToResponse({
				headers: corsOrigin
					? {
							"Access-Control-Allow-Credentials": "true",
							"Access-Control-Allow-Origin": corsOrigin,
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

const INTERRUPTED_GENERATE_VIDEO_OUTPUT: GenerateVideoOutput = {
	message:
		"The video request was interrupted before it could be queued. If the " +
		"user still wants it, call generate_video again with the brief.",
	status: "unavailable",
};

const INCOMPLETE_GENERATE_VIDEO_INPUT: GenerateVideoInput = {
	aspect: "16:9",
	brief: "The creative brief was lost when the request stream was interrupted.",
	durationSeconds: 10,
	title: "Interrupted video request",
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

			if (part.type === "tool-generate_video") {
				if (
					part.state !== "input-available" &&
					part.state !== "input-streaming"
				) {
					return part;
				}

				changed = true;

				const parsedInput = generateVideoInputSchema.safeParse(part.input);

				return {
					...part,
					input: parsedInput.success
						? parsedInput.data
						: INCOMPLETE_GENERATE_VIDEO_INPUT,
					output: INTERRUPTED_GENERATE_VIDEO_OUTPUT,
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

/**
 * Stable id for one stream TURN, used as the at-most-once reservation key.
 * The last message's id alone is not turn-unique: resumed rounds (ask_user
 * answers, tool approvals) append parts to the SAME assistant message, so its
 * id repeats while the conversation advances — keying on it alone made every
 * resume a "replay" and capped chats at one exchange. Fingerprinting the last
 * message's part states makes each answered round a distinct operation while
 * an exact retry of the same round still maps to the same key.
 */
export function turnRequestId(
	messages: readonly WanditUIMessage[],
): string | null {
	const last = messages.at(-1);

	if (!last) {
		return null;
	}

	const signature = createHash("sha256")
		.update(String(messages.length))
		.update(":")
		.update(last.id)
		.update(":")
		.update(
			JSON.stringify(
				(last.parts ?? []).map((part) => [
					part.type,
					(part as { state?: string }).state ?? null,
				]),
			),
		)
		.digest("hex")
		.slice(0, 16);

	return `${last.id}:${signature}`;
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

const DOCUMENT_MEDIA_TYPE_SET = new Set<string>(
	ATTACHMENT_MEDIA_TYPES.filter((mediaType) => !mediaType.startsWith("image/")),
);

/**
 * Document twin of collectAvailableImages: read_attachment's URL allowlist,
 * derived from validated transcript parts (user file parts plus ask_user
 * attachment answers), never from model input.
 */
function collectAvailableDocuments(
	messages: readonly WanditUIMessage[],
): AvailableDocument[] {
	const documents = new Map<string, AvailableDocument>();

	const add = (url: string, mediaType: string, filename?: string) => {
		if (!DOCUMENT_MEDIA_TYPE_SET.has(mediaType)) {
			return;
		}

		documents.set(url, {
			...(filename ? { filename } : {}),
			mediaType,
			url,
		});
	};

	for (const message of messages) {
		for (const part of message.parts) {
			if (message.role === "user" && part.type === "file") {
				add(part.url, part.mediaType, part.filename);
				continue;
			}

			if (part.type === "tool-ask_user" && part.state === "output-available") {
				for (const file of part.output.files ?? []) {
					add(file.url, file.mediaType, file.filename);
				}
			}
		}
	}

	return [...documents.values()];
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
