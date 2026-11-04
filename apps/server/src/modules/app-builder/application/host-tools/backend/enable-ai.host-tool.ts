/**
 * The `enable_ai` host tool of the builder turn. `BuilderHostToolRegistry`
 * builds it per turn. It stores the per-project AI gateway key and pushes
 * it with the gateway URL to the Supabase Edge Function secrets, through
 * `AppAiKeys`. The key never reaches the agent.
 */
import {
	APP_AI_DEFAULT_MODEL,
	APP_AI_KEY_SECRET_NAME,
	APP_AI_MODELS,
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

/** `enable_ai`: turns the AI gateway on; a repeated call keeps the key. */
export function createEnableAiTool(
	deps: EnableAiToolDeps,
	context: HostToolContext,
): Tool<EnableAiToolInput, EnableAiToolOutput> {
	return tool({
		description:
			"Turn on AI for this app. The app can then call AI models through the " +
			"Wandit AI gateway. Call this tool once, before you deploy the Edge " +
			"Function that calls AI. A second call keeps the key. The tool stores " +
			"two Edge Function secrets: WANDIT_AI_API_KEY and WANDIT_AI_GATEWAY_URL. " +
			"Only a Supabase Edge Function calls the gateway, never the browser or " +
			"the app. The function reads both values with Deno.env.get. It sends " +
			"POST to the WANDIT_AI_GATEWAY_URL value plus `/chat/completions`, with " +
			"the header `Authorization: Bearer <the WANDIT_AI_API_KEY value>`. " +
			"The body uses the OpenAI chat completions format: model, messages, and " +
			"stream. Use fetch. Do not install an AI package. Pick the model from " +
			"the tool answer. Never put the key in the code, the chat, or a VITE_ " +
			"or EXPO_PUBLIC_ value. Each call uses the user's credits. When the " +
			"feature is behind sign-in, the function checks the user with " +
			"`supabase.auth.getUser()` first. The function answers OPTIONS with " +
			"CORS headers. A 402 answer means the credits are used up. A 429 answer " +
			"means try again later. Show a short message to the app user for both.",
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
						models: [...APP_AI_MODELS],
						status: "enabled",
						urlSecretName: APP_AI_URL_SECRET_NAME,
					};
				},
			),
	});
}
