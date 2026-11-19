/**
 * The `enable_ai` host tool of the builder turn. `BuilderHostToolRegistry`
 * builds it per turn. It stores the per-project AI gateway key and pushes
 * it with the gateway URL to the Supabase Edge Function secrets, through
 * `AppAiKeys`. The key never reaches the agent.
 */
import {
	APP_AI_DEFAULT_MODEL,
	APP_AI_KEY_SECRET_NAME,
	APP_AI_MEDIA_MODELS,
	APP_AI_MODELS,
	APP_AI_SPEECH_VOICES,
	APP_AI_URL_SECRET_NAME,
	type EnableAiToolInput,
	type EnableAiToolOutput,
	enableAiToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import { AppAiKeys } from "../../services/app-ai-keys";
import type { ProjectSecretsService } from "../../services/project-secrets.service";
import { type BackendToolDeps, runBackendTool } from "./backend-tool-deps";
import { secretActor } from "./set-secret.host-tool";

/** The backend tool deps, plus the insert-if-absent write and the read back of the key row. */
export type EnableAiToolDeps = BackendToolDeps & {
	secrets: Pick<ProjectSecretsService, "setSystemIfAbsent" | "readSystemValue">;
};

/**
 * `enable_ai`: turns the AI gateway on; a repeated call keeps the key. The
 * description teaches the chat and media routes to every project, also old ones.
 */
export function createEnableAiTool(
	deps: EnableAiToolDeps,
	context: HostToolContext,
): Tool<EnableAiToolInput, EnableAiToolOutput> {
	return tool({
		description:
			"Turn on AI for this app. The app can then call AI models through the " +
			"Wandit AI gateway. Call this tool once, before you deploy the Edge " +
			"Function that calls AI. A second call keeps the key. Call it again to " +
			"read mediaModels and speechVoices when they are not in this chat. " +
			"The tool stores two Edge Function secrets: WANDIT_AI_API_KEY and " +
			"WANDIT_AI_GATEWAY_URL. " +
			"Only a Supabase Edge Function calls the gateway, never the browser or " +
			"the app. The function reads both values with Deno.env.get. It sends " +
			"POST to the WANDIT_AI_GATEWAY_URL value plus `/chat/completions`, with " +
			"the header `Authorization: Bearer <the WANDIT_AI_API_KEY value>`. " +
			"The body uses the OpenAI chat completions format: model, messages, and " +
			"stream. Use fetch. Do not install an AI package. Pick the model from " +
			"the tool answer. Keep defaultModel unless the app needs a stronger " +
			"model: a larger model costs many times more credits. " +
			"Never put the key in the code, the chat, or a VITE_ " +
			"or EXPO_PUBLIC_ value. Each call uses the project's credits. When the " +
			"feature is behind sign-in, the function checks the user with " +
			"`supabase.auth.getUser()` first. The function answers OPTIONS with " +
			"CORS headers. A 402 answer means the credits are used up. A 429 answer " +
			"means try again later. Show a short message to the app user for both. " +
			// Media routes. Old projects learn them only from this text.
			"The same base URL and header also serve media. The tool answer lists " +
			"the models of each kind in mediaModels; the first id is the default. " +
			"It lists voice ids in speechVoices. The function sets the model and " +
			"every value that changes the price, and caps the client input. " +
			"POST /images/generations: JSON { model, prompt (at most 4000 " +
			"characters), n (1 to 4), size }. A google/ model takes n 1 and size " +
			"1K or 2K only (gemini-2.5-flash-image: no size). The other models " +
			"take no size. Leave out size for the default. The answer is " +
			"{ created, data: [{ b64_json }] }: base64 " +
			"images. A google/ answer with no image is a 400 and costs credits. " +
			"POST /audio/speech: JSON { model, input (at most 10000 characters), " +
			"voice }. The answer is MP3 bytes. " +
			"POST /audio/transcriptions: multipart form data with the fields file " +
			"and model, in any order. " +
			"The file is WAV, M4A or MP4 (AAC), WebM or Ogg (Opus), at most 15 MiB and 5 " +
			"minutes. A larger file answers 413. The gateway reads the format from " +
			"the content type of the file part, which must start with audio/. Keep " +
			"the type of the recorded blob. The answer is { text, " +
			"language, duration }. " +
			"The function stores an image or an MP3 in a private Supabase Storage " +
			"bucket and answers a signed URL. A mobile app always gets a signed URL. " +
			"A web app can also get the bytes with Content-Type " +
			"application/octet-stream: then invoke gives a Blob, not text. " +
			"A video is a job, because an Edge Function must answer in 150 " +
			"seconds. POST /videos: JSON { model, prompt (at most 2000 " +
			"characters), seconds, resolution (default 480p), aspect_ratio (16:9 " +
			"or 9:16), audio }. Seconds and resolutions of each model: " +
			"heygen-video-1 5 to 14, 480p 768p 1080p 2k; seedance-2.5-flash 4 to " +
			"15, 480p 720p; seedance-2.5 4 to 15, 480p 720p 1080p; minimax-h3-max " +
			"5 to 15, 480p 768p. Only Seedance takes audio true; the other models " +
			"decide the sound. The model, seconds, and resolution set the price: keep the default model and 480p unless the user asks for more. " +
			"The answer is { id, status: queued, model, " +
			"seconds }. The " +
			"client polls every 5 seconds through the Edge Function. The function " +
			"calls GET /videos/status?id=<the id, URL-encoded>. The status is " +
			"in_progress, completed, failed, or expired. On completed, the function " +
			"calls GET /videos/content?id=<the id, URL-encoded> once, stores the " +
			"bytes in Supabase Storage, and answers a signed URL. The content route " +
			"answers 409 before completed or for a failed job, and 410 for an " +
			"expired job. A 429, 502, or 503 on a poll means: poll again later. A " +
			"404 is an end: the id is not valid or older than 24 hours. A failed " +
			"or expired job costs no credits. A completed job costs credits also " +
			"when no one reads it, so save the job id in a table row and continue " +
			"the polls after a reload. " +
			"When the project has the ai-media skill, load it for the examples.",
		inputSchema: enableAiToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{ input, inputSchema: enableAiToolInputSchema, tool: "enable_ai" },
				async (active): Promise<EnableAiToolOutput> => {
					await new AppAiKeys({
						audit: deps.audit,
						secrets: deps.secrets,
					}).enable(active, secretActor(context));
					return {
						defaultModel: APP_AI_DEFAULT_MODEL,
						keySecretName: APP_AI_KEY_SECRET_NAME,
						mediaModels: APP_AI_MEDIA_MODELS,
						models: [...APP_AI_MODELS],
						speechVoices: [...APP_AI_SPEECH_VOICES],
						status: "enabled",
						urlSecretName: APP_AI_URL_SECRET_NAME,
					};
				},
			),
	});
}
