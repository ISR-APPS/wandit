/**
 * The `set_secret` host tool of the builder turn (WANDIT-186).
 * `BuilderHostToolRegistry` builds it per turn. It pushes one project
 * secret to the Supabase Edge Function secrets through
 * `BackendSecretsService`; with `generate` it first stores a random value
 * through `ProjectSecretsService`. The value never reaches the agent.
 */
import { randomBytes } from "node:crypto";

import {
	type SetSecretToolInput,
	type SetSecretToolOutput,
	setSecretToolInputSchema,
} from "@wandit/contracts";
import { type Tool, tool } from "ai";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import { BackendSecretsService } from "../../services/backend-secrets.service";
import type { SecretActor } from "../../services/project-secrets.service";
import { type BackendToolDeps, runBackendTool } from "./backend-tool-deps";

// 32 random bytes: 256 bits, enough for a signing or an encryption key.
const GENERATED_SECRET_BYTES = 32;

/** `set_secret`: pushes a stored or a generated secret; never answers the value. */
export function createSetSecretTool(
	deps: BackendToolDeps,
	context: HostToolContext,
): Tool<SetSecretToolInput, SetSecretToolOutput> {
	return tool({
		description:
			"Make ONE secret available to the app's Supabase Edge Functions as an " +
			"environment variable. Never put a secret value in the chat, the code, " +
			"or a tool input. `source: project_secret` sends the value the user " +
			"saved in the Cloud tab; `missing` means the user must add it there " +
			"first, so tell the user the secret name. `source: generate` creates a " +
			"random 32-byte value (for example a signing key) when none exists and " +
			"keeps an existing one. `name` uses A-Z, 0-9, and _, and starts with a " +
			"letter. Names that start with `SUPABASE_` are reserved.",
		inputSchema: setSecretToolInputSchema,
		execute: (input) =>
			runBackendTool(
				deps,
				context,
				{ input, inputSchema: setSecretToolInputSchema, tool: "set_secret" },
				async (
					{ backend, backendId, client },
					{ name, source },
				): Promise<SetSecretToolOutput> => {
					// A repeated call must not rotate a key the app already uses, for
					// example a signing key. The user rotates a secret in the Cloud tab.
					if (
						source === "generate" &&
						(await deps.secrets.readValue(context.projectId, name)) === null
					) {
						await deps.secrets.set(
							context.projectId,
							name,
							randomBytes(GENERATED_SECRET_BYTES).toString("base64url"),
							"user",
							secretActor(context),
						);
					}
					const pushed = await new BackendSecretsService({
						client,
						now: deps.now,
						secrets: deps.secrets,
						secretsRepo: deps.secretsRepo,
					}).push(backend, name);
					if (pushed === "missing") {
						return { name, status: "missing" };
					}
					await deps.audit.insert({
						action: "secret.synced",
						actorUserId: context.actorUserId,
						metadata: { name, source },
						organizationId: context.organizationId,
						projectId: context.projectId,
						targetId: backendId,
						targetType: "app_backend",
					});
					return { name, status: "synced" };
				},
			),
	});
}

// The turn's actor in the turn's workspace: `ProjectSecretsService.set`
// checks the project against this scope. A task has no client IP.
function secretActor(context: HostToolContext): SecretActor {
	return {
		ip: null,
		scope:
			context.organizationId === null
				? { kind: "personal", userId: context.actorUserId }
				: {
						actorIsLimitExempt: context.subject.actorIsLimitExempt ?? false,
						kind: "org",
						organizationId: context.organizationId,
						userId: context.actorUserId,
					},
	};
}
