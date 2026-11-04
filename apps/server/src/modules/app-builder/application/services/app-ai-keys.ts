/**
 * Mint, rotate, and push of the per-project AI gateway key. The `enable_ai`
 * host tool (Trigger task `builder-turn`) and `AppAiKeysService` (the AI
 * panel routes) call `AppAiKeys`. It stores the key through
 * `ProjectSecretsService` and pushes it through `SupabaseManagementClient`.
 * No Nest import, so the Trigger task graph stays small. No method answers
 * or logs the key.
 */
import {
	APP_AI_KEY_SECRET_NAME,
	APP_AI_URL_SECRET_NAME,
	appBuilderRoutes,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { projectOwnerColumns } from "../../../projects/domain/project-scope";
import { mintAppAiKey } from "../../domain/app-ai-key";
import type { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import type { ActiveBackend } from "../host-tools/backend/backend-tool-deps";
import type {
	ProjectSecretsService,
	SecretActor,
} from "./project-secrets.service";

/** A key write: `enable` keeps a stored key, `rotate` replaces it. */
export type AppAiKeyAction = "enable" | "rotate";

/**
 * Mints, rotates, and pushes the gateway key of one project. The caller
 * resolves an active backend first, because each write ends with the push.
 */
export class AppAiKeys {
	constructor(
		private readonly deps: {
			/** Stores the key as an encrypted `system` row of `project_secrets`, and reads it back after the push. */
			secrets: Pick<
				ProjectSecretsService,
				"setSystemIfAbsent" | "set" | "readSystemValue"
			>;
			/** Writes the `secret.synced` audit row of each push. */
			audit: Pick<AuditEventsRepository, "insert">;
		},
	) {}

	/**
	 * Mints a key when the project has none and pushes the stored key. A
	 * repeated call keeps the key, so a running app never breaks.
	 */
	async enable(active: ActiveBackend, actor: SecretActor): Promise<void> {
		const { projectId } = active.backend;
		const key = await this.deps.secrets.setSystemIfAbsent(
			projectId,
			APP_AI_KEY_SECRET_NAME,
			mintAppAiKey(projectId),
			actor,
		);
		await this.push(active, actor, key, "enable");
	}

	/** Stores a new key and pushes it. The gateway refuses the old key at once. */
	async rotate(active: ActiveBackend, actor: SecretActor): Promise<void> {
		const { projectId } = active.backend;
		const key = mintAppAiKey(projectId);
		// The store goes first. When the push fails, a repeated enable or
		// rotate pushes a stored key again; no key exists only in Supabase.
		await this.deps.secrets.set(
			projectId,
			APP_AI_KEY_SECRET_NAME,
			key,
			"system",
			actor,
		);
		await this.push(active, actor, key, "rotate");
	}

	private async push(
		active: ActiveBackend,
		actor: SecretActor,
		key: string,
		source: AppAiKeyAction,
	): Promise<void> {
		// One call sends both names, so the function never holds a new URL
		// with an old key.
		const send = (value: string) =>
			active.client.bulkCreateSecrets(active.backend, [
				{ name: APP_AI_KEY_SECRET_NAME, value },
				{ name: APP_AI_URL_SECRET_NAME, value: appAiGatewayUrl() },
			]);
		await send(key);
		// Another key write can land during the push. Send the stored key, so
		// Supabase ends with it. No row means a turn off: no second send.
		// LIMIT: three key writes at the same time can still end on an old key. Upgrade: one lock per project around the store and the push.
		const stored = await this.deps.secrets.readSystemValue(
			active.backend.projectId,
			APP_AI_KEY_SECRET_NAME,
		);
		if (stored !== null && stored !== key) {
			await send(stored);
		}
		await this.deps.audit.insert({
			action: "secret.synced",
			actorUserId: actor.scope.userId,
			ip: actor.ip,
			metadata: { name: APP_AI_KEY_SECRET_NAME, source },
			organizationId: projectOwnerColumns(actor.scope).organizationId,
			projectId: active.backend.projectId,
			targetId: active.backendId,
			targetType: "app_backend",
		});
	}
}

/**
 * Value of the `WANDIT_AI_GATEWAY_URL` secret, with no trailing slash. The
 * host is the LLM proxy host (`llmProxyBaseUrl`); local dev sets a tunnel,
 * because a Supabase Edge Function cannot reach localhost.
 */
function appAiGatewayUrl(): string {
	return new URL(
		appBuilderRoutes.appAiBase,
		env.V2_LLM_PROXY_PUBLIC_URL ?? env.BETTER_AUTH_URL,
	).toString();
}
