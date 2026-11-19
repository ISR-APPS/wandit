/**
 * Fastify controller of the app AI gateway, in the OpenAI formats: chat,
 * image generation, text to speech, speech to text, and video jobs. A V2 app's
 * Supabase Edge Function calls it with its per-project key. `@Public()`:
 * the key in `Authorization: Bearer` is the only auth. No CORS change: a
 * browser must never hold the key. `AppAiGatewayService` (chat),
 * `AppAiMediaService` (media), and `AppAiVideoService` (video) do the checks,
 * the upstream call, and the bill.
 */
import {
	Controller,
	Get,
	Inject,
	Post,
	type RawBodyRequest,
	Req,
	Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { Public } from "../../../../auth";
import {
	AppAiRefusal,
	UPSTREAM_TIMEOUT_MS,
} from "../../../application/services/app-ai-admission";
import { AppAiGatewayService } from "../../../application/services/app-ai-gateway.service";
import {
	type AppAiAudioUpload,
	AppAiMediaService,
} from "../../../application/services/app-ai-media.service";
import {
	type AppAiQueryRequest,
	AppAiVideoService,
} from "../../../application/services/app-ai-video.service";
import { FastifyProxyReply } from "./llm-proxy.controller";

/**
 * Routes under `/api/v2/ai/v1`. `main.ts` sets the 4 MiB body limit of
 * `chat/completions` (images as data URLs). The media JSON routes keep the
 * 1 MiB default, because a public route stays tight.
 */
@Public()
@SkipResponseEnvelope()
@Controller("v2/ai/v1")
export class AppAiGatewayController {
	constructor(
		@Inject(AppAiGatewayService) private readonly gateway: AppAiGatewayService,
		@Inject(AppAiMediaService) private readonly media: AppAiMediaService,
		@Inject(AppAiVideoService) private readonly video: AppAiVideoService,
	) {}

	@Post("chat/completions")
	async chatCompletions(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.gateway.chatCompletions(input, proxyReply),
		);
	}

	@Post("images/generations")
	async imageGenerations(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.media.createImages(input, proxyReply),
		);
	}

	@Post("audio/speech")
	async speech(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.media.createSpeech(input, proxyReply),
		);
	}

	// Multipart: the global limit of `main.ts` caps the file at 15 MiB.
	@Post("audio/transcriptions")
	async transcriptions(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.media.createTranscription(
				input,
				() => readAudioUpload(request),
				proxyReply,
			),
		);
	}

	@Post("videos")
	async createVideo(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.video.createVideo(input, proxyReply),
		);
	}

	// The job id is in the query: Fastify caps a path parameter at 100 characters.
	@Get("videos/status")
	async videoStatus(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.video.videoStatus(input, proxyReply),
		);
	}

	@Get("videos/content")
	async videoContent(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.video.videoContent(input, proxyReply),
		);
	}

	// The webhook of the Vercel AI Gateway; the billing token in the query is its only auth.
	@Post("videos/callback")
	async videoCallback(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		await this.serve(request, reply, (input, proxyReply) =>
			this.video.videoCallback(input, proxyReply),
		);
	}

	// Gives the handler the client abort signal and closes a socket that
	// is open longer than the upstream timeout.
	private async serve(
		request: RawBodyRequest<FastifyRequest>,
		reply: FastifyReply,
		handle: (
			input: AppAiQueryRequest,
			proxyReply: FastifyProxyReply,
		) => Promise<void>,
	): Promise<void> {
		const abort = new AbortController();
		// `close` fires on client abort and on normal end; `writableEnded`
		// tells them apart.
		const onClose = () => {
			if (!reply.raw.writableEnded) {
				abort.abort();
			}
		};
		reply.raw.once("close", onClose);
		// A client that left before the line above never fires `close` again.
		if (reply.raw.destroyed) {
			abort.abort();
		}
		// Money: a client that stops reading blocks each write, so the hold
		// stays reserved until the sweep refunds it for free. Closing the
		// socket ends the write, and the call settles.
		const deadline = setTimeout(() => {
			if (!reply.raw.writableEnded) {
				reply.raw.destroy();
			}
		}, UPSTREAM_TIMEOUT_MS);
		try {
			await handle(
				{
					authorization: request.headers.authorization,
					body: request.rawBody ?? Buffer.alloc(0),
					query: request.query,
					abortSignal: abort.signal,
				},
				new FastifyProxyReply(reply),
			);
		} finally {
			clearTimeout(deadline);
			reply.raw.off("close", onClose);
		}
	}
}

// A 400 for a bad multipart form, in the OpenAI error body.
function badUpload(message: string): AppAiRefusal {
	return new AppAiRefusal({ status: 400, code: "invalid_request", message });
}

/**
 * Reads the one audio file and the `model` field of a transcription form, in
 * any order. The service calls it after the key, project, and rate checks.
 * Throws `AppAiRefusal` 400 for a bad form and 413 above 15 MiB.
 */
export async function readAudioUpload(
	request: FastifyRequest,
): Promise<AppAiAudioUpload> {
	let upload: Omit<AppAiAudioUpload, "model"> | undefined;
	let model: string | undefined;
	try {
		// `parts()` reads the whole form, so a `model` after the file is not lost.
		// Security: 20 text fields of 16 KiB at most keep the memory of this public route small.
		for await (const part of request.parts({
			limits: { fields: 20, fieldSize: 16 * 1024 },
		})) {
			if (part.type === "field") {
				if (part.fieldname !== "model") {
					continue;
				}
				// A JSON part gives an object, and a repeated field is ambiguous.
				if (model !== undefined || typeof part.value !== "string") {
					throw badUpload("Send model one time, as a text field.");
				}
				model = part.value;
				continue;
			}
			// `files: 1` of `main.ts` makes this the only file part of the form.
			if (part.fieldname !== "file") {
				throw badUpload("The form has no audio file in the field file.");
			}
			// Basic check of the part header, as the V1 voice route does.
			if (!part.mimetype.startsWith("audio/")) {
				throw badUpload("The file must have an audio/ content type.");
			}
			upload = { audio: await part.toBuffer(), mediaType: part.mimetype };
		}
	} catch (error) {
		throw uploadRefusal(request, error);
	}
	if (upload === undefined) {
		throw badUpload("The form has no audio file in the field file.");
	}
	return { ...upload, model };
}

// Maps an error of the multipart parser to the answer of the app.
function uploadRefusal(request: FastifyRequest, error: unknown): AppAiRefusal {
	if (error instanceof AppAiRefusal) {
		return error;
	}
	// The global multipart limit of `main.ts` stops the stream at 15 MiB.
	if (
		error instanceof request.server.multipartErrors.RequestFileTooLargeError
	) {
		return new AppAiRefusal({
			status: 413,
			code: "invalid_request",
			message: "The audio file is larger than 15 MiB.",
		});
	}
	// All other parser errors come from the client body: not multipart, a
	// second file, too many fields, or a cut stream.
	return badUpload(
		"Send multipart/form-data with one audio file in the field file and an optional model field.",
	);
}
