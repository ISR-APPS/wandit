/**
 * Contract of the media routes of the app AI gateway: image, speech,
 * transcription, and video. An app calls them from its Supabase Edge
 * Function with its `wnd_ai_` key. The API parses each body with these
 * schemas, and the `enable_ai` tool and the AI panel list the models.
 */
import { z } from "zod";

import { uuidSchema } from "../v1/shared/primitives";

/**
 * Image models an app may call. The first id is the default. The three
 * Google ids are language models with image output: a call asks for one
 * image (n = 1). It bills the gateway cost of the answer, else the tokens
 * plus each image. Seedream and Muse bill a flat price for each image.
 */
export const APP_AI_IMAGE_MODELS = [
	"google/gemini-nano-banana-2.1",
	"google/gemini-3.1-flash-image",
	"google/gemini-2.5-flash-image",
	"bytedance/seedream-5.5",
	"meta/muse-image-1.0",
] as const;

/** Runtime validator of an app image model id. */
export const appAiImageModelSchema = z.enum(APP_AI_IMAGE_MODELS);

/** TypeScript app image model id. */
export type AppAiImageModel = z.infer<typeof appAiImageModelSchema>;

/**
 * Text-to-speech models, priced for each input character. The first id is
 * the default.
 */
export const APP_AI_SPEECH_MODELS = [
	"elevenlabs/eleven-flash-v2.5",
	"elevenlabs/eleven-v4-turbo",
	"elevenlabs/eleven-v4",
	"elevenlabs/eleven-multilingual-v2",
] as const;

/** Runtime validator of an app speech model id. */
export const appAiSpeechModelSchema = z.enum(APP_AI_SPEECH_MODELS);

/** TypeScript app speech model id. */
export type AppAiSpeechModel = z.infer<typeof appAiSpeechModelSchema>;

/**
 * Speech-to-text models, priced for each second of audio. The first id is
 * the default.
 */
export const APP_AI_TRANSCRIPTION_MODELS = [
	"elevenlabs/scribe-v2",
	"openai/gpt-transcribe",
] as const;

/** Runtime validator of an app transcription model id. */
export const appAiTranscriptionModelSchema = z.enum(
	APP_AI_TRANSCRIPTION_MODELS,
);

/** TypeScript app transcription model id. */
export type AppAiTranscriptionModel = z.infer<
	typeof appAiTranscriptionModelSchema
>;

/**
 * Text-to-video models, priced for each output second by resolution. The
 * first id is the default: HeyGen is the cheapest (0.01 USD a second at 480p).
 * Seedance 2.5 bills video tokens; the API turns them into a rate a second.
 */
export const APP_AI_VIDEO_MODELS = [
	"heygen/heygen-video-1",
	"bytedance/seedance-2.5-flash",
	"bytedance/seedance-2.5",
	"minimax/minimax-h3-max",
] as const;

/** Runtime validator of an app video model id. */
export const appAiVideoModelSchema = z.enum(APP_AI_VIDEO_MODELS);

/** TypeScript app video model id. */
export type AppAiVideoModel = z.infer<typeof appAiVideoModelSchema>;

/**
 * All video resolutions of the allowed models. Each model takes only the
 * resolutions of its row in `APP_AI_VIDEO_CAPABILITIES`. A key of the price rows.
 */
export const APP_AI_VIDEO_RESOLUTIONS = [
	"480p",
	"720p",
	"768p",
	"1080p",
	"2k",
] as const;

/** Runtime validator of a video resolution; also a key of the price rows. */
export const appAiVideoResolutionSchema = z.enum(APP_AI_VIDEO_RESOLUTIONS);

/** TypeScript video resolution. */
export type AppAiVideoResolution = z.infer<typeof appAiVideoResolutionSchema>;

/**
 * Video aspect ratios an app may ask for. Every allowed video model takes
 * both at each of its resolutions. Seedance 2.5 bills the same pixels for both.
 */
export const APP_AI_VIDEO_ASPECT_RATIOS = ["16:9", "9:16"] as const;

/** What one video model accepts, beyond the shared aspect ratios. */
export type AppAiVideoCapability = {
	/** Allowed lengths in whole seconds. At most 15 s for every model in this version. */
	seconds: readonly number[];
	/** Allowed resolutions, from `video_capabilities.supported_resolutions`. */
	resolutions: readonly AppAiVideoResolution[];
	/**
	 * `optional`: the app turns generated sound on or off. `fixed`: the model
	 * decides the sound and takes no audio flag. Audio does not change the price.
	 */
	audio: "optional" | "fixed";
};

/**
 * Capabilities of each video model, from the catalog on 2026-11-19. The
 * request schema refuses a length, a resolution, or an audio flag that the
 * model does not take. Seconds stop at 15: this bounds the hold and keeps
 * a job inside the 40 minute hold sweep. HeyGen stops at 14 s, because its
 * catalog rows for clips "over 15 s" have an undocumented edge at 15 s.
 */
export const APP_AI_VIDEO_CAPABILITIES: Record<
	AppAiVideoModel,
	AppAiVideoCapability
> = {
	"heygen/heygen-video-1": {
		seconds: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
		resolutions: ["480p", "768p", "1080p", "2k"],
		audio: "fixed",
	},
	"bytedance/seedance-2.5-flash": {
		seconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
		resolutions: ["480p", "720p"],
		audio: "optional",
	},
	"bytedance/seedance-2.5": {
		seconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
		resolutions: ["480p", "720p", "1080p"],
		audio: "optional",
	},
	"minimax/minimax-h3-max": {
		seconds: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
		resolutions: ["480p", "768p"],
		audio: "fixed",
	},
};

/**
 * Allowed form of an ElevenLabs voice id. The app can send any voice id
 * of this form, also one that is not in `APP_AI_SPEECH_VOICES`.
 */
export const APP_AI_SPEECH_VOICE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** One ElevenLabs voice that the builder agent can pick. */
export const appAiSpeechVoiceSchema = z.object({
	id: z.string().regex(APP_AI_SPEECH_VOICE_PATTERN),
	// Display name of the voice, for the agent and the user.
	name: z.string().min(1),
});

/** Parsed speech voice. */
export type AppAiSpeechVoice = z.infer<typeof appAiSpeechVoiceSchema>;

/** ElevenLabs voice ids from the Vercel and AI SDK docs, for the agent. */
export const APP_AI_SPEECH_VOICES = [
	{ id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
	{ id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella" },
	{ id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
	{ id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
] as const satisfies readonly AppAiSpeechVoice[];

/**
 * The media models of each kind, in the AI panel status and the
 * `enable_ai` answer. The first id of each list is the default.
 */
export const appAiMediaModelsSchema = z.object({
	image: z.array(appAiImageModelSchema),
	video: z.array(appAiVideoModelSchema),
	speech: z.array(appAiSpeechModelSchema),
	transcription: z.array(appAiTranscriptionModelSchema),
});

/** Parsed media model lists. */
export type AppAiMediaModels = z.infer<typeof appAiMediaModelsSchema>;

/** The value of `mediaModels` that the API sends. */
export const APP_AI_MEDIA_MODELS = {
	image: [...APP_AI_IMAGE_MODELS],
	video: [...APP_AI_VIDEO_MODELS],
	speech: [...APP_AI_SPEECH_MODELS],
	transcription: [...APP_AI_TRANSCRIPTION_MODELS],
} satisfies AppAiMediaModels;

/**
 * Body of `POST /api/v2/ai/v1/images/generations`. z.object drops other
 * fields, so no field changes the price behind the allow list. The service
 * checks `size` against the size prices of the model.
 */
export const appAiImageGenerationRequestSchema = z.object({
	model: appAiImageModelSchema.default(APP_AI_IMAGE_MODELS[0]),
	// 4,000 characters bound the body of a public route. The gateway sets no prompt limit.
	prompt: z.string().min(1).max(4000),
	// Images in one call. 4 bounds the cost of one call.
	n: z.int().min(1).max(4).default(1),
	// A size with its own price row: `1K` or `2K` on a Google model. Seedream and
	// Muse have no size row, so a size on them answers 400. 32 characters bound the log line.
	size: z.string().min(1).max(32).optional(),
});

/** Parsed image body, with the defaults of `model` and `n` applied. */
export type AppAiImageGenerationRequest = z.infer<
	typeof appAiImageGenerationRequestSchema
>;

/** 200 answer of the image route, in the OpenAI images format. */
export const appAiImageGenerationResponseSchema = z.object({
	// Unix time in seconds.
	created: z.int().nonnegative(),
	// One entry for each delivered image, as base64 bytes.
	data: z.array(z.object({ b64_json: z.string() })),
});

/** Parsed image answer. */
export type AppAiImageGenerationResponse = z.infer<
	typeof appAiImageGenerationResponseSchema
>;

/**
 * Body of `POST /api/v2/ai/v1/audio/speech`. The answer is the MP3 bytes
 * with the content type `audio/mpeg`.
 */
export const appAiSpeechRequestSchema = z.object({
	model: appAiSpeechModelSchema.default(APP_AI_SPEECH_MODELS[0]),
	// 10,000 characters: the limit of the v4 and multilingual models.
	input: z.string().min(1).max(10_000),
	voice: z.string().regex(APP_AI_SPEECH_VOICE_PATTERN),
	response_format: z.literal("mp3").default("mp3"),
});

/**
 * Text fields of the multipart body of `POST /api/v2/ai/v1/audio/transcriptions`.
 * The `file` part holds the audio and is read on its own.
 */
export const appAiTranscriptionFieldsSchema = z.object({
	model: appAiTranscriptionModelSchema.default(APP_AI_TRANSCRIPTION_MODELS[0]),
});

/** 200 answer of the transcription route. */
export const appAiTranscriptionResponseSchema = z.object({
	text: z.string(),
	// ISO 639-1 code from the provider; null when it sends none.
	language: z.string().nullable(),
	// Audio length in seconds from the provider; null when it sends none.
	duration: z.number().nullable(),
});

/** Parsed transcription answer. */
export type AppAiTranscriptionResponse = z.infer<
	typeof appAiTranscriptionResponseSchema
>;

/**
 * Body of `POST /api/v2/ai/v1/videos`. The check after the fields refuses
 * a length, a resolution, or an audio flag that the model does not take.
 * The length and the resolution change the price.
 */
export const appAiVideoRequestSchema = z
	.object({
		model: appAiVideoModelSchema.default(APP_AI_VIDEO_MODELS[0]),
		// 2,000 characters bound the body of a public route. The price does not
		// change with the prompt length.
		prompt: z.string().min(1).max(2000),
		// Video length in whole seconds.
		seconds: z.int(),
		// 480p is the default: every allowed model has it, and it is the cheapest tier.
		resolution: appAiVideoResolutionSchema.default("480p"),
		aspect_ratio: z.enum(APP_AI_VIDEO_ASPECT_RATIOS).default("16:9"),
		// True adds generated sound on a model with `audio: "optional"`.
		audio: z.boolean().default(false),
	})
	.superRefine((request, context) => {
		const capability = APP_AI_VIDEO_CAPABILITIES[request.model];
		if (!capability.seconds.includes(request.seconds)) {
			context.addIssue({
				code: "custom",
				path: ["seconds"],
				message: `${request.model} takes one of these lengths in seconds: ${capability.seconds.join(", ")}.`,
			});
		}
		if (!capability.resolutions.includes(request.resolution)) {
			context.addIssue({
				code: "custom",
				path: ["resolution"],
				message: `${request.model} takes one of these resolutions: ${capability.resolutions.join(", ")}.`,
			});
		}
		if (request.audio && capability.audio !== "optional") {
			context.addIssue({
				code: "custom",
				path: ["audio"],
				message: `${request.model} decides the sound itself. Leave out audio.`,
			});
		}
		// Money: BytePlus also reads --rs, --dur, and --rt in the prompt as the
		// resolution, the length, and the ratio. The hold bills only the body fields.
		if (
			request.model.startsWith("bytedance/") &&
			request.prompt.includes("--")
		) {
			context.addIssue({
				code: "custom",
				path: ["prompt"],
				message: "A Seedance prompt cannot contain --. Use one dash.",
			});
		}
	});

/** 200 answer of the video create route. */
export const appAiVideoCreateResponseSchema = z.object({
	// The signed job token; the app sends it back to the status routes.
	id: z.string().min(1),
	status: z.literal("queued"),
	model: appAiVideoModelSchema,
	seconds: z.int().positive(),
});

/** Parsed video create answer. */
export type AppAiVideoCreateResponse = z.infer<
	typeof appAiVideoCreateResponseSchema
>;

/**
 * 200 answer of `GET /videos/status?id=<job id>`. `expired` means the hold
 * ran out before the job finished, so the app gets no video.
 */
export const appAiVideoStatusResponseSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["in_progress", "completed", "failed", "expired"]),
	error: z.object({ message: z.string() }).optional(),
});

/** Parsed video status answer. */
export type AppAiVideoStatusResponse = z.infer<
	typeof appAiVideoStatusResponseSchema
>;

/**
 * Highest length of a job id or a billing token, in characters. The
 * operation cap of 2,048 gives a token of about 3,800 characters.
 */
export const APP_AI_VIDEO_TOKEN_MAX_CHARS = 8192;

/**
 * Query of `GET /videos/status` and `GET /videos/content`. The job id goes
 * in the query because Fastify caps a path parameter at 100 characters.
 */
export const appAiVideoJobQuerySchema = z.object({
	// The job token from the create answer.
	id: z.string().min(1).max(APP_AI_VIDEO_TOKEN_MAX_CHARS),
});

/** Query of `POST /videos/callback`: the billing token that the API minted. */
export const appAiVideoCallbackQuerySchema = z.object({
	token: z.string().min(1).max(APP_AI_VIDEO_TOKEN_MAX_CHARS),
});

/**
 * Highest size of the upstream operation in a job token, as JSON
 * characters. 2,048 is far above the `{ gatewayJobId }` form in the docs.
 */
export const APP_AI_VIDEO_OPERATION_MAX_CHARS = 2048;

// The signed claims that bill one video job. Both token kinds carry them.
const appAiVideoBillingFields = {
	projectId: uuidSchema,
	// Id of the `ai_usage_events` row of the hold; null when billing is off.
	eventId: uuidSchema.nullable(),
	model: appAiVideoModelSchema,
	// Video length in whole seconds; the billed units.
	seconds: z.int().positive(),
	resolution: appAiVideoResolutionSchema,
	audio: z.boolean(),
	// Provider cost of the video in USD micros.
	costUsdMicros: z.int().nonnegative(),
	// Price of one second of video in USD micros, from the quote.
	usdMicrosPerSecond: z.int().positive(),
	// USD micros for one whole credit at the time of the hold.
	usdMicrosPerCredit: z.int().positive(),
	// Expiry in unix seconds.
	exp: z.int().positive(),
};

/**
 * Claims of the video job token: the `id` the app gets. The literal `kind`
 * keeps a billing token or an LLM run token from passing as a job token.
 */
export const appAiVideoJobClaimsSchema = z.object({
	kind: z.literal("app_ai_video_job"),
	...appAiVideoBillingFields,
	// The opaque value of `experimental_startVideo`, sent back to read the status.
	operation: z
		.json()
		.refine(
			(operation) =>
				JSON.stringify(operation).length <= APP_AI_VIDEO_OPERATION_MAX_CHARS,
			"The video operation is too large.",
		),
});

/** Parsed job token claims. */
export type AppAiVideoJobClaims = z.infer<typeof appAiVideoJobClaimsSchema>;

/**
 * Claims of the billing token in the webhook URL. It has no operation, so
 * the webhook can settle the hold but cannot read the video.
 */
export const appAiVideoBillingClaimsSchema = z.object({
	kind: z.literal("app_ai_video_billing"),
	...appAiVideoBillingFields,
});

/** Parsed billing token claims. */
export type AppAiVideoBillingClaims = z.infer<
	typeof appAiVideoBillingClaimsSchema
>;

/**
 * Body of the Vercel AI Gateway video webhook. Only `type` changes what the
 * API does: `video.generation.completed` settles the hold. z.object drops the
 * other fields, so a change of the `data` form never blocks a settle.
 */
export const appAiVideoCallbackSchema = z.object({
	type: z.string(),
});
