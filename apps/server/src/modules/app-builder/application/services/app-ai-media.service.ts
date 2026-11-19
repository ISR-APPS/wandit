/**
 * The media routes of the app AI gateway: image generation, text to
 * speech, and speech to text. `AppAiGatewayController` calls it for each
 * call of an app's Edge Function. `AppAiAdmission` checks the key, the
 * project, the rate window, and holds the credits. This service quotes the
 * exact price. It calls the Vercel AI Gateway through the AI SDK and
 * settles the hold per unit. A Google image settles by the gateway cost,
 * else by its images plus its tokens.
 */
import { randomUUID } from "node:crypto";

import { createGateway, type GatewayProvider } from "@ai-sdk/gateway";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	APP_AI_IMAGE_MODELS,
	APP_AI_MAX_OUTPUT_TOKENS,
	APP_AI_SPEECH_MODELS,
	APP_AI_TRANSCRIPTION_MODELS,
	type AppAiImageGenerationRequest,
	type AppAiImageGenerationResponse,
	type AppAiTranscriptionResponse,
	appAiGatewayCostSchema,
	appAiImageGenerationRequestSchema,
	appAiSpeechRequestSchema,
	appAiTranscriptionFieldsSchema,
} from "@wandit/contracts";
import { generateImage, generateText } from "ai";

import {
	normalizeAudioMediaType,
	readAudioDurationSeconds,
} from "../../../generation/application/services/audio-duration";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import {
	imageGenerateSizes,
	imageUnitUsdMicros,
	type MeasuredCostEstimate,
	type ModelPrice,
	usdMicrosToCentiCredits,
} from "../../../metering/domain/model-pricing";
import { TRANSCRIPTION_MAX_DURATION_SECONDS } from "../../../metering/domain/operation-registry";
import {
	appAiGatewayUsdToMicros,
	parseAppAiFields,
	parseAppAiJsonBody,
} from "../../domain/app-ai-request";
import {
	AppAiAdmission,
	type AppAiAnyModel,
	type AppAiFailure,
	type AppAiHold,
	type AppAiProject,
	AppAiRefusal,
	type AppAiTrace,
	appAiAttribution,
	METERING_PROVIDER,
	requireParsedBody,
	UPSTREAM_ERROR,
	UPSTREAM_TIMEOUT_MS,
	upstreamErrorFailure,
} from "./app-ai-admission";
import type { AppAiGatewayRequest } from "./app-ai-gateway.service";
import { LLM_PROXY_FETCH, type LlmProxyReply } from "./llm-proxy.service";

// The `imageSize` values that a Google image call may send. 4K stays out:
// the output token cap can cut a 4K answer, and 4K is a preview at Google.
const GOOGLE_IMAGE_SIZES: readonly string[] = ["1K", "2K"];

/**
 * The audio file of one transcription call, read from the multipart body.
 * `AppAiGatewayController` reads it; the service asks for it after the checks.
 */
export type AppAiAudioUpload = {
	audio: Buffer;
	/** Content type of the `file` part, for example `audio/webm;codecs=opus`. */
	mediaType: string;
	/** The `model` text field of the form, before or after the file; undefined when absent. */
	model: string | undefined;
};

/** One media call that passed the checks before the hold. */
type MediaJob = {
	project: AppAiProject;
	model: AppAiAnyModel;
	/** The exact price of `units`; it sizes the hold and gives the unit rate. */
	quote: MeasuredCostEstimate;
	/** What one billed unit is, for the price terms of the usage event. */
	unit: "image" | "character" | "second";
	/**
	 * Units the hold pays for: images asked for, input characters, or audio
	 * seconds from the container (a fraction is possible).
	 */
	units: number;
	/** Runs the upstream call with the Wandit gateway provider. */
	deliver: (gateway: GatewayProvider) => Promise<MediaDelivery>;
};

/**
 * What the upstream gave back for one media job. A `refusal` means the
 * upstream did the work, so the charge bills, but the app gets the refusal.
 */
type MediaDelivery = {
	/** Units the upstream delivered; the charge. Zero refunds the hold, except with a `refusal`. */
	units: number;
	/**
	 * The full charge in USD micros when it is not `units` x the unit price.
	 * Only a Google image sets it: the gateway cost, or images plus tokens.
	 */
	costUsdMicros?: number;
} & (
	| {
			/** Content type of the 200 answer to the app. */
			contentType: string;
			body: Buffer;
	  }
	| { refusal: AppAiFailure }
);

/** What the upstream step tells the bill; `status` goes to the log line. */
type MediaOutcome =
	| { kind: "failed"; status: number }
	| {
			kind: "delivered";
			status: number;
			units: number;
			/** `MediaDelivery.costUsdMicros`, when the upstream step set it. */
			costUsdMicros?: number;
	  };

/** Application service of the media routes; see the file header. */
@Injectable()
export class AppAiMediaService {
	private readonly logger = new Logger(AppAiMediaService.name);

	constructor(
		@Inject(AppAiAdmission) private readonly admission: AppAiAdmission,
		@Inject(ModelPricingService)
		private readonly pricing: Pick<
			ModelPricingService,
			| "get"
			| "quoteImageEstimate"
			| "quoteSpeechEstimate"
			| "quoteTokenUsage"
			| "quoteTranscriptionEstimate"
		>,
		@Inject(MeteringService)
		private readonly metering: Pick<MeteringService, "refund" | "settle">,
		@Inject(LLM_PROXY_FETCH) private readonly upstreamFetch: typeof fetch,
	) {}

	/**
	 * Answers one `POST /api/v2/ai/v1/images/generations` with the OpenAI
	 * images JSON. It bills each delivered image at the price of its size. A
	 * Google image model bills the gateway cost of the answer, else each image
	 * plus its tokens.
	 */
	async createImages(
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.serve(input, reply, async (trace) => {
			const project = await this.admission.checkKeyAndProject(
				input.authorization,
				trace,
			);
			const request = requireParsedBody(
				parseAppAiJsonBody(
					appAiImageGenerationRequestSchema,
					input.body,
					APP_AI_IMAGE_MODELS,
				),
			);
			trace.model = request.model;
			await this.admission.checkRate(project.projectId, "generation", trace);

			const price = await this.pricing.get(request.model);
			if (price === null) {
				throw this.admission.unpriced(trace);
			}
			// The catalog type selects the call form and the bill. The hourly price
			// refresh can change it; the rate checks of the Google flow fail closed.
			if (price.modelType === "language") {
				return this.googleImageJob(project, request, price, trace);
			}
			// No listed image model has a price for each size, so a size answers 400.
			pricedSize(price.modelId, [], request.size);
			const quote = await this.pricing.quoteImageEstimate(
				request.model,
				request.n,
			);
			if (quote === null) {
				throw this.admission.unpriced(trace);
			}
			return {
				project,
				model: request.model,
				quote,
				unit: "image",
				units: request.n,
				deliver: async (gateway) => {
					const result = await generateImage({
						model: gateway.imageModel(request.model),
						prompt: request.prompt,
						n: request.n,
						providerOptions: appAiAttribution(project),
						// Money path: a retry would bill the upstream twice for one hold.
						maxRetries: 0,
						// Not the client signal: a client abort must not lose paid output.
						abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
					});
					// A warning can show a wrong image, so Sentry gets it. The charge does not change.
					if (result.warnings.length > 0) {
						this.admission.alert(
							"App AI image upstream sent warnings",
							trace,
							JSON.stringify(result.warnings),
						);
					}
					// Money: the hold pays for `n` images, so an extra one is not sent.
					const images = result.images.slice(0, request.n);
					// LIMIT: the full answer is in memory, at most 4 base64 images.
					// Upgrade: write each image to the reply when it is encoded.
					const answer = {
						created: Math.floor(Date.now() / 1000),
						data: images.map((image) => ({ b64_json: image.base64 })),
					} satisfies AppAiImageGenerationResponse;
					return {
						units: images.length,
						contentType: "application/json",
						body: Buffer.from(JSON.stringify(answer), "utf8"),
					};
				},
			};
		});
	}

	// The job of a Google image model (catalog type "language"). It runs
	// generateText, reads the images from `result.files`, and bills the
	// gateway cost, else each image plus the tokens.
	private async googleImageJob(
		project: AppAiProject,
		request: AppAiImageGenerationRequest,
		price: ModelPrice,
		trace: AppAiTrace,
	): Promise<MediaJob> {
		const defaultImageUsdMicros = price.imageUsdMicros;
		if (
			defaultImageUsdMicros === null ||
			price.inputUsdMicrosPerMTok === null ||
			price.outputUsdMicrosPerMTok === null
		) {
			throw this.admission.unpriced(trace);
		}
		// Google takes no image count, so one call asks for one image.
		if (request.n !== 1) {
			throw new AppAiRefusal({
				status: 400,
				code: "invalid_request",
				message: `${request.model} makes one image for each call. Send n = 1.`,
			});
		}
		// Money: no paid call proves that the gateway forwards `imageSize`. A
		// dropped option makes the default size, so a size must not cost less.
		const size = pricedSize(
			price.modelId,
			imageGenerateSizes(price)
				.filter((label) => GOOGLE_IMAGE_SIZES.includes(label))
				.filter(
					(label) =>
						(imageUnitUsdMicros(price, label) ?? 0) >= defaultImageUsdMicros,
				),
			request.size,
		);
		const imageQuote = await this.pricing.quoteImageEstimate(
			request.model,
			1,
			size,
		);
		if (imageQuote === null) {
			throw this.admission.unpriced(trace);
		}
		// The credit anchor of the quote, so the token part uses the same rate.
		const usdMicrosPerCredit = imageQuote.pricingSnapshot.usdMicrosPerCredit;
		// Money: a token is never shorter than one UTF-8 byte, and the output
		// cap bounds the text and thinking tokens.
		const promptBytes = Buffer.byteLength(request.prompt, "utf8");
		// One call, so the prompt size picks the tier rate.
		const tokenHold = await this.pricing.quoteTokenUsage(
			request.model,
			{ inputTokens: promptBytes, outputTokens: APP_AI_MAX_OUTPUT_TOKENS },
			usdMicrosPerCredit,
			promptBytes,
		);
		// LIMIT: the hold pays one image, and the settle bills each image of the
		// answer. A prompt that asks for more images can take the payer below 0.
		// Upgrade: hold more images, or send only the images that the hold pays.
		const holdUsdMicros = imageQuote.costUsdMicros + tokenHold.costUsdMicros;
		return {
			project,
			model: request.model,
			quote: {
				...imageQuote,
				costUsdMicros: holdUsdMicros,
				credits: usdMicrosToCentiCredits(holdUsdMicros, usdMicrosPerCredit),
			},
			unit: "image",
			units: 1,
			deliver: async (gateway) => {
				const result = await generateText({
					model: gateway.languageModel(request.model),
					prompt: request.prompt,
					maxOutputTokens: APP_AI_MAX_OUTPUT_TOKENS,
					providerOptions: {
						...appAiAttribution(project),
						google: {
							// The value of the Vercel docs. Without IMAGE the model answers text only.
							responseModalities: ["TEXT", "IMAGE"],
							...(size === undefined
								? {}
								: { imageConfig: { imageSize: size } }),
						},
					},
					// Money path: a retry would bill the upstream twice for one hold.
					maxRetries: 0,
					// Not the client signal: a client abort must not lose paid output.
					abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
				});
				// A warning, for example an ignored size, can show a wrong image. The
				// charge does not change, because a size never costs less than the default.
				if (result.warnings !== undefined && result.warnings.length > 0) {
					this.admission.alert(
						"App AI image upstream sent warnings",
						trace,
						JSON.stringify(result.warnings),
					);
				}
				// Google bills each image of the answer, so each one goes to the app.
				// A file with no bytes is not an image.
				const images = result.files.filter(
					(file) =>
						file.mediaType.startsWith("image/") && file.base64.length > 0,
				);
				const gatewayCost = appAiGatewayCostSchema.safeParse(
					result.providerMetadata?.gateway,
				);
				// BYOK: `cost` can be 0 while `marketCost` has the list rate, so the highest value wins.
				let costUsdMicros = gatewayCost.success
					? appAiGatewayUsdToMicros(
							Math.max(
								gatewayCost.data.cost ?? 0,
								gatewayCost.data.marketCost ?? 0,
							),
						)
					: null;
				if (costUsdMicros === null) {
					const hasTokenCounts =
						result.usage.inputTokens !== undefined &&
						result.usage.outputTokens !== undefined;
					this.admission.alert(
						"App AI image answer had no gateway cost",
						trace,
						hasTokenCounts
							? undefined
							: "The usage has no token counts. The token part of the hold bills.",
					);
					const tokenCostUsdMicros = hasTokenCounts
						? (
								await this.pricing.quoteTokenUsage(
									request.model,
									result.usage,
									usdMicrosPerCredit,
									result.usage.inputTokens,
								)
							).costUsdMicros
						: tokenHold.costUsdMicros;
					costUsdMicros =
						imageQuote.unitUsdMicros * images.length + tokenCostUsdMicros;
				}
				if (images.length === 0) {
					// No image and no cost: the upstream did no paid work, so this is an
					// empty answer and the hold is refunded.
					if (costUsdMicros === 0) {
						return {
							units: 0,
							contentType: "application/json",
							body: Buffer.alloc(0),
						};
					}
					// Google bills the tokens of an answer with no image, so the cost
					// settles, and the app gets a 400.
					return {
						units: 0,
						costUsdMicros,
						refusal: {
							status: 400,
							code: "invalid_request",
							message: `${request.model} made no image for this prompt (finish reason: ${result.finishReason}). Change the prompt.`,
						},
					};
				}
				// LIMIT: the full answer is in memory, usually one base64 image of 2K
				// or less. Upgrade: write each image to the reply when it is encoded.
				const answer = {
					created: Math.floor(Date.now() / 1000),
					data: images.map((image) => ({ b64_json: image.base64 })),
				} satisfies AppAiImageGenerationResponse;
				return {
					units: images.length,
					costUsdMicros,
					contentType: "application/json",
					body: Buffer.from(JSON.stringify(answer), "utf8"),
				};
			},
		};
	}

	/**
	 * Answers one `POST /api/v2/ai/v1/audio/speech` with the MP3 bytes.
	 * It bills each input character at the rate of the model.
	 */
	async createSpeech(
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.serve(input, reply, async (trace) => {
			const project = await this.admission.checkKeyAndProject(
				input.authorization,
				trace,
			);
			const request = requireParsedBody(
				parseAppAiJsonBody(
					appAiSpeechRequestSchema,
					input.body,
					APP_AI_SPEECH_MODELS,
				),
			);
			trace.model = request.model;
			await this.admission.checkRate(project.projectId, "generation", trace);

			// Money: UTF-16 units are never fewer than the code points that the
			// provider bills. Thus the charge is never below its cost.
			const characters = request.input.length;
			const quote = await this.pricing.quoteSpeechEstimate(
				request.model,
				characters,
			);
			if (quote === null) {
				throw this.admission.unpriced(trace);
			}
			return {
				project,
				model: request.model,
				quote,
				unit: "character",
				units: characters,
				deliver: async (gateway) => {
					// `doGenerate` has no retry layer: one call, one upstream bill.
					const result = await gateway.speechModel(request.model).doGenerate({
						text: request.input,
						voice: request.voice,
						outputFormat: request.response_format,
						providerOptions: appAiAttribution(project),
						// Not the client signal: a client abort must not lose paid output.
						abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
					});
					// The gateway can ignore the voice or the mp3 format. A warning shows
					// it in Sentry. The charge does not change.
					if (result.warnings.length > 0) {
						this.admission.alert(
							"App AI speech upstream sent warnings",
							trace,
							JSON.stringify(result.warnings),
						);
					}
					// The gateway sends base64 text; the model type also allows bytes.
					const audio =
						typeof result.audio === "string"
							? Buffer.from(result.audio, "base64")
							: Buffer.from(result.audio);
					return {
						units: audio.length > 0 ? characters : 0,
						contentType: "audio/mpeg",
						body: audio,
					};
				},
			};
		});
	}

	/**
	 * Answers one `POST /api/v2/ai/v1/audio/transcriptions` with the text.
	 * `readUpload` reads the multipart file; it runs only after the key,
	 * project, and rate checks. It bills each audio second at the model rate.
	 */
	async createTranscription(
		input: AppAiGatewayRequest,
		readUpload: () => Promise<AppAiAudioUpload>,
		reply: LlmProxyReply,
	): Promise<void> {
		await this.serve(input, reply, async (trace) => {
			const project = await this.admission.checkKeyAndProject(
				input.authorization,
				trace,
			);
			await this.admission.checkRate(project.projectId, "generation", trace);
			// Security: the server buffers the file only after the checks above.
			// LIMIT: the rate window counts starts, not uploads in progress. One key can
			// hold 60 uploads of 15 MiB each minute, each for at most 300 s, before a
			// hold (about 4.4 GiB). Upgrade: a cap on uploads in progress for each
			// project, or a Fastify requestTimeout.
			const upload = await readUpload();
			const request = requireParsedBody(
				parseAppAiFields(
					appAiTranscriptionFieldsSchema,
					{ model: upload.model },
					APP_AI_TRANSCRIPTION_MODELS,
				),
			);
			trace.model = request.model;

			// Money: the container length sizes the hold before the paid call.
			const containerSeconds = readAudioDurationSeconds(
				upload.audio,
				upload.mediaType,
			);
			if (containerSeconds === null) {
				throw new AppAiRefusal({
					status: 400,
					code: "invalid_request",
					message:
						"The audio length cannot be read. Send WAV, M4A or MP4 (AAC), WebM or Ogg (Opus) audio.",
				});
			}
			if (containerSeconds > TRANSCRIPTION_MAX_DURATION_SECONDS) {
				throw new AppAiRefusal(audioLengthRefusal());
			}
			const quote = await this.pricing.quoteTranscriptionEstimate(
				request.model,
				containerSeconds,
			);
			if (quote === null) {
				throw this.admission.unpriced(trace);
			}
			return {
				project,
				model: request.model,
				quote,
				unit: "second",
				units: containerSeconds,
				deliver: async (gateway) => {
					// `doGenerate` has no retry layer: one call, one upstream bill.
					const result = await gateway
						.transcriptionModel(request.model)
						.doGenerate({
							audio: upload.audio,
							mediaType: normalizeAudioMediaType(upload.mediaType),
							providerOptions: appAiAttribution(project),
							// Not the client signal: a client abort must not lose paid output.
							abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
						});
					// The rule of TranscriptionService: the provider length bills when it is
					// a real number, else the container length.
					// LIMIT: with no provider length, a false container length bills, and it
					// can be below the real length. Upgrade: read the length from the audio frames.
					const providerSeconds =
						result.durationInSeconds !== undefined &&
						Number.isFinite(result.durationInSeconds) &&
						result.durationInSeconds > 0
							? result.durationInSeconds
							: null;
					if (
						providerSeconds !== null &&
						providerSeconds > TRANSCRIPTION_MAX_DURATION_SECONDS
					) {
						// The container gave a false length. The upstream did the work, so
						// the real length bills, but the app gets no text.
						this.admission.alert(
							"App AI audio is longer than its container length",
							trace,
						);
						return {
							units: providerSeconds,
							refusal: audioLengthRefusal(),
						};
					}
					const answer = {
						text: result.text,
						language: result.language ?? null,
						duration: providerSeconds,
					} satisfies AppAiTranscriptionResponse;
					return {
						units: providerSeconds ?? containerSeconds,
						contentType: "application/json",
						body: Buffer.from(JSON.stringify(answer), "utf8"),
					};
				},
			};
		});
	}

	// The shared flow of each media call. It does the checks, reads the
	// upstream key, and holds the credits. Then it calls the upstream,
	// sends the answer, and does one settle or one refund.
	private async serve(
		input: AppAiGatewayRequest,
		reply: LlmProxyReply,
		admit: (trace: AppAiTrace) => Promise<MediaJob>,
	): Promise<void> {
		const startedAt = Date.now();
		const trace: AppAiTrace = {
			requestId: randomUUID(),
			projectId: null,
			model: null,
		};
		let admitted: {
			job: MediaJob;
			upstreamKey: string;
			hold: AppAiHold | null;
		};
		try {
			const job = await admit(trace);
			const upstreamKey = this.admission.upstreamKey(trace);
			const hold = await this.admission.hold(
				job.project,
				{
					credits: job.quote.credits,
					estimatedCostUsdMicros: job.quote.costUsdMicros,
					model: job.model,
				},
				trace,
			);
			admitted = { job, upstreamKey, hold };
		} catch (error) {
			if (!(error instanceof AppAiRefusal)) {
				// The Nest filter sends the 500; the log keeps one line for each request.
				this.logRequest(trace, 500, null, null, startedAt);
				throw error;
			}
			await this.admission.sendFailure(
				reply,
				input.abortSignal,
				trace,
				error.failure,
			);
			this.logRequest(trace, error.failure.status, null, null, startedAt);
			return;
		}

		// A throw in the upstream step leaves "failed", so the hold is refunded.
		let outcome: MediaOutcome = { kind: "failed", status: 500 };
		try {
			outcome = await this.callUpstream(
				admitted.job,
				admitted.upstreamKey,
				input.abortSignal,
				reply,
				trace,
			);
		} finally {
			// Every path after the reserve ends here: one refund or one settle.
			const credits = await this.closeHold(
				admitted.job,
				admitted.hold,
				outcome,
				trace,
			);
			this.logRequest(
				trace,
				outcome.status,
				outcome.kind === "delivered" ? outcome.units : null,
				credits,
				startedAt,
			);
		}
	}

	private async callUpstream(
		job: MediaJob,
		upstreamKey: string,
		abortSignal: AbortSignal,
		reply: LlmProxyReply,
		trace: AppAiTrace,
	): Promise<MediaOutcome> {
		let delivery: MediaDelivery;
		try {
			// Security: the Wandit key goes only to the upstream; the app key stays here.
			delivery = await job.deliver(
				createGateway({ apiKey: upstreamKey, fetch: this.upstreamFetch }),
			);
		} catch (error) {
			const failure = upstreamErrorFailure(error);
			if (failure.status >= 500) {
				this.admission.alert("App AI media upstream call failed", trace, error);
			}
			await this.admission.sendFailure(reply, abortSignal, trace, failure);
			return { kind: "failed", status: failure.status };
		}
		// A refusal comes first: a Google answer with no image has 0 units, but
		// its tokens bill.
		if ("refusal" in delivery) {
			await this.admission.sendFailure(
				reply,
				abortSignal,
				trace,
				delivery.refusal,
			);
			return {
				kind: "delivered",
				status: delivery.refusal.status,
				units: delivery.units,
				costUsdMicros: delivery.costUsdMicros,
			};
		}
		if (delivery.units === 0) {
			// An empty answer delivers nothing, so the app pays nothing.
			this.admission.alert("App AI media upstream answer was empty", trace);
			await this.admission.sendFailure(
				reply,
				abortSignal,
				trace,
				UPSTREAM_ERROR,
			);
			return { kind: "failed", status: UPSTREAM_ERROR.status };
		}
		await this.admission.writeWhole(
			reply,
			abortSignal,
			200,
			{ "content-type": delivery.contentType, "x-request-id": trace.requestId },
			delivery.body,
		);
		return {
			kind: "delivered",
			status: 200,
			units: delivery.units,
			costUsdMicros: delivery.costUsdMicros,
		};
	}

	// Returns the charged centi-credits, or null when nothing is known
	// (billing off, or a settle error). Never throws.
	private async closeHold(
		job: MediaJob,
		hold: AppAiHold | null,
		outcome: MediaOutcome,
		trace: AppAiTrace,
	): Promise<number | null> {
		if (hold === null) {
			return null;
		}
		try {
			if (outcome.kind === "failed") {
				await this.metering.refund(hold.eventId, "app_ai_upstream_failed");
				return 0;
			}
			// Audio seconds can be a fraction, so the cost rounds up to whole micros.
			const costUsdMicros =
				outcome.costUsdMicros ??
				Math.ceil(job.quote.unitUsdMicros * outcome.units);
			// The credit anchor of the quote, so a config change during the call
			// does not change the price.
			const usdMicrosPerCredit = job.quote.pricingSnapshot.usdMicrosPerCredit;
			const event = await this.metering.settle(hold.eventId, {
				costUsdMicros,
				finalCredits: usdMicrosToCentiCredits(
					costUsdMicros,
					usdMicrosPerCredit,
				),
				model: job.model,
				pricing: "direct",
				pricingSnapshot: {
					costUsdMicros,
					mode: "measured",
					modelId: job.model,
					operation: "app_ai_gateway",
					refreshedAt: job.quote.pricingSnapshot.refreshedAt,
					reservedUnits: job.units,
					source: job.quote.pricingSnapshot.source,
					unit: job.unit,
					units: outcome.units,
					unitUsdMicros: job.quote.unitUsdMicros,
					usdMicrosPerCredit,
				},
				provider: METERING_PROVIDER,
			});
			return event.finalCredits;
		} catch (error) {
			// LIMIT: a DB error or an API restart during the call can lose the settle.
			// Then the sweep refunds the hold after 40 min, and the call is free.
			// Upgrade: store the upstream generation id with
			// MeteringService.captureGeneration, so the sweep reconciles the hold.
			this.admission.alert("App AI hold settle or refund failed", trace, error);
			return null;
		}
	}

	private logRequest(
		trace: AppAiTrace,
		status: number,
		units: number | null,
		credits: number | null,
		startedAt: number,
	): void {
		this.logger.log({
			event: "app-ai.media-request",
			...trace,
			status,
			units,
			credits,
			latencyMs: Date.now() - startedAt,
		});
	}
}

/**
 * The size to send and to bill, in the form of its price row (`2k` gives
 * `2K`). Money: a size changes the cost, so only a size of `sizes` passes.
 * No size uses the default price. Throws `AppAiRefusal` 400 for any other size.
 */
function pricedSize(
	modelId: string,
	sizes: readonly string[],
	size: string | undefined,
): string | undefined {
	if (size === undefined) {
		return undefined;
	}
	const match = sizes.find(
		(priced) => priced.toLowerCase() === size.toLowerCase(),
	);
	if (match !== undefined) {
		return match;
	}
	throw new AppAiRefusal({
		status: 400,
		code: "invalid_request",
		message:
			sizes.length === 0
				? `${modelId} takes no size. Remove the size field.`
				: `${modelId} takes one of these sizes: ${sizes.join(", ")}.`,
	});
}

// 400 for an audio length outside the limit of `operation-registry.ts`.
function audioLengthRefusal(): AppAiFailure {
	return {
		status: 400,
		code: "invalid_request",
		message: `The audio must be at most ${TRANSCRIPTION_MAX_DURATION_SECONDS} seconds long.`,
	};
}
