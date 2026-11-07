/**
 * The AI panel routes of a V2 project (`AppAiController`): the status, the
 * key writes, and the turn off. The key writes go through `AppAiKeys`; the
 * usage comes from `MeteringService`. No method answers or logs the key.
 */
import {
	ConflictException,
	type HttpException,
	Inject,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import {
	APP_AI_DEFAULT_MODEL,
	APP_AI_KEY_SECRET_NAME,
	APP_AI_MODELS,
	type AppAiStatus,
	type BackendToolFailure,
} from "@wandit/contracts";
import { Sentry } from "@wandit/observability/nestjs";

import { MeteringService } from "../../../metering/application/services/metering.service";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { ProjectsRepository } from "../../../projects/infrastructure/persistence/projects.repository";
import { monthStartUtc } from "../../domain/turn-caps";
import { AppBackendsRepository } from "../../infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../../infrastructure/persistence/audit-events.repository";
import {
	SUPABASE_MANAGEMENT_CLIENT,
	type SupabaseManagementClient,
	SupabaseManagementError,
	SupabaseRateLimitedError,
} from "../../infrastructure/supabase/supabase-management.client";
import { resolveActiveBackend } from "../host-tools/backend/backend-tool-deps";
import { type AppAiKeyAction, AppAiKeys } from "./app-ai-keys";
import { CloudRateLimitedException } from "./cloud.service";
import {
	ProjectSecretsService,
	type SecretActor,
} from "./project-secrets.service";

/**
 * The routes of the AI panel (`AppAiController`): the status, the key
 * writes, and the turn off. Each method answers 404 for a foreign, V1, or
 * deleted project before any other read.
 */
@Injectable()
export class AppAiKeysService {
	private readonly keys: AppAiKeys;

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		@Inject(ProjectsRepository)
		private readonly projects: Pick<
			ProjectsRepository,
			"findEngineByIdForScope"
		>,
		@Inject(AppBackendsRepository)
		private readonly backends: Pick<
			AppBackendsRepository,
			"findByProjectId" | "touchActive"
		>,
		/** Null without `SUPABASE_PLATFORM_TOKEN`: a key write then answers 503. */
		@Inject(SUPABASE_MANAGEMENT_CLIENT)
		private readonly client: SupabaseManagementClient | null,
		@Inject(ProjectSecretsService)
		private readonly secrets: Pick<
			ProjectSecretsService,
			| "listNames"
			| "setSystemIfAbsent"
			| "set"
			| "readSystemValue"
			| "removeSystem"
		>,
		@Inject(AuditEventsRepository)
		audit: Pick<AuditEventsRepository, "insert">,
		@Inject(MeteringService)
		private readonly metering: Pick<MeteringService, "monthlyBilledUsage">,
	) {
		this.keys = new AppAiKeys({ audit, secrets });
	}

	/** `GET /ai`: on or off, the date of the key, and the usage of this UTC month. */
	async status(scope: ProjectScope, projectId: string): Promise<AppAiStatus> {
		const { secrets } = await this.secrets.listNames(scope, projectId);
		// Security: only the `system` row is the key. A `user` row of the same
		// name, from before the `WANDIT_` rule, never turns the gateway on.
		const key = secrets.find(
			(secret) =>
				secret.kind === "system" && secret.name === APP_AI_KEY_SECRET_NAME,
		);
		const usage = await this.metering.monthlyBilledUsage(
			projectId,
			"app_ai_gateway",
			monthStartUtc(new Date()),
		);
		return {
			defaultModel: APP_AI_DEFAULT_MODEL,
			enabled: key !== undefined,
			keyUpdatedAt: key?.updatedAt ?? null,
			models: [...APP_AI_MODELS],
			monthCredits: usage.credits,
			monthRequests: usage.requests,
		};
	}

	/**
	 * `PUT /ai/key` (enable) and `POST /ai/key/rotate`. Answers 409
	 * `BACKEND_PAUSED` or `BACKEND_NOT_READY` like the Cloud tab, and 429 or
	 * 503 when Supabase refuses the push.
	 */
	async writeKey(
		action: AppAiKeyAction,
		scope: ProjectScope,
		projectId: string,
		/** Client IP of the request, for the audit rows. */
		ip: string | null,
	): Promise<AppAiStatus> {
		if (
			(await this.projects.findEngineByIdForScope(scope, projectId)) !==
			"v2_app"
		) {
			throw new NotFoundException();
		}
		// Each write ends with the push. The backend check runs before the
		// mint, so a paused or missing backend never gets a new key. When the
		// push fails after a rotate, the app keeps the old key, and the
		// gateway refuses it. A later enable pushes the stored key.
		const active = await resolveActiveBackend(
			{ backends: this.backends, client: this.client, logger: Sentry.logger },
			projectId,
		);
		if ("status" in active) {
			throw backendFailure(active);
		}

		const actor: SecretActor = { ip, scope };
		try {
			await (action === "enable"
				? this.keys.enable(active, actor)
				: this.keys.rotate(active, actor));
		} catch (error) {
			// The same answers as the Cloud tab: a full bucket is 429 with the
			// wait, another Supabase failure is 503.
			if (error instanceof SupabaseRateLimitedError) {
				// The limiter counts milliseconds; `Retry-After` holds whole seconds.
				throw new CloudRateLimitedException(
					Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
				);
			}
			if (error instanceof SupabaseManagementError) {
				Sentry.logger.warn("app-ai.push-failed", {
					projectId,
					requestId: error.requestId,
					status: error.status,
				});
				throw new ServiceUnavailableException({
					code: "UPSTREAM_UNAVAILABLE",
					message: "Supabase did not answer",
				});
			}
			throw error;
		}
		return this.status(scope, projectId);
	}

	/**
	 * `DELETE /ai/key`: deletes the key row. The gateway reads the row on
	 * each call, so the app's AI stops at once. No key is no error.
	 */
	async disable(
		scope: ProjectScope,
		projectId: string,
		/** Client IP of the request, for the audit row. */
		ip: string | null,
	): Promise<void> {
		await this.secrets.removeSystem(projectId, APP_AI_KEY_SECRET_NAME, {
			ip,
			scope,
		});
	}
}

// The Cloud tab answers these codes, so the web already shows them.
function backendFailure(failure: BackendToolFailure): HttpException {
	switch (failure.status) {
		case "backend_paused":
			return new ConflictException({
				code: "BACKEND_PAUSED",
				message: "The backend is paused; restore it first",
			});
		case "backend_not_ready":
			return new ConflictException({
				code: "BACKEND_NOT_READY",
				message: "The backend is not ready",
			});
		case "rate_limited":
			return new CloudRateLimitedException(
				Math.max(1, failure.retryAfterSeconds),
			);
		case "failed":
			// `resolveActiveBackend` fails only without the platform client.
			return new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: failure.reason,
			});
	}
}
