/**
 * Shared parts of the agent backend tools (WANDIT-186). It holds the
 * dependency type, the active-backend check, the Supabase error mapping,
 * and `runBackendTool`, the body of every tool `execute`. The seven tool
 * factories in this folder call them. `BuilderHostToolRegistry` passes the
 * deps. Nothing here starts a provisioning or a restore; a tool call on an
 * active backend stamps its activity for the pause sweep (WANDIT-184).
 */
import type { BackendToolFailure, BackendToolName } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { z } from "zod";

import type { HostToolContext } from "../../../domain/ports/host-tools";
import type { AppBackendsRepository } from "../../../infrastructure/persistence/app-backends.repository";
import type { AuditEventsRepository } from "../../../infrastructure/persistence/audit-events.repository";
import type { ProjectSecretsRepository } from "../../../infrastructure/persistence/project-secrets.repository";
import {
	type BackendRef,
	type SupabaseManagementClient,
	SupabaseManagementError,
	SupabaseRateLimitedError,
} from "../../../infrastructure/supabase/supabase-management.client";
import type { ProjectSecretsService } from "../../services/project-secrets.service";

/** What the registry hands every backend tool factory; the task composes it. */
export type BackendToolDeps = {
	/** Reads the `app_backends` row of the project, and stamps the activity of an active one. */
	backends: Pick<AppBackendsRepository, "findByProjectId" | "touchActive">;
	/**
	 * The interactive Management API client. Null when
	 * `SUPABASE_PLATFORM_TOKEN` or `SUPABASE_PLATFORM_ORG_ID` is unset.
	 */
	client: SupabaseManagementClient | null;
	/** Reads a stored secret value; `set_secret` also stores a generated one. */
	secrets: Pick<ProjectSecretsService, "readValue" | "set">;
	/** Stamps `synced_to_backend_at` after a push. */
	secretsRepo: Pick<ProjectSecretsRepository, "markSynced">;
	/** Writes the `backend.*` and `secret.synced` audit rows. */
	audit: Pick<AuditEventsRepository, "insert">;
	/** The Trigger.dev logger in the task; one info line per tool call. */
	logger: Pick<Console, "info" | "warn">;
	/** The clock of the migration file stamp and the sync stamp; specs pin it. */
	now: () => Date;
};

/** A backend a tool may call: the client, the ref, and the row id. */
export type ActiveBackend = {
	client: SupabaseManagementClient;
	backend: BackendRef;
	/** `app_backends.id`; the audit rows name it as their target. */
	backendId: string;
};

/**
 * Answers the active backend of the project, or the failure a tool
 * answers at once: no client, a paused backend, or no active backend.
 * The rule matches `CloudService.requireActiveBackend`. An active answer
 * also stamps `lastActiveAt`; a failed stamp only logs.
 */
export async function resolveActiveBackend(
	deps: Pick<BackendToolDeps, "backends" | "client" | "logger">,
	projectId: string,
): Promise<ActiveBackend | BackendToolFailure> {
	if (deps.client === null) {
		return { reason: "SUPABASE_PLATFORM_TOKEN is not set", status: "failed" };
	}
	// A tool only reads the row. Provisioning runs at project creation (D18),
	// and a restore belongs to the Cloud tab and the backend lifecycle.
	const row = await deps.backends.findByProjectId(projectId);
	if (row?.status === "paused") {
		return { status: "backend_paused" };
	}
	if (row === null || row.status !== "active" || row.ref === null) {
		return { status: "backend_not_ready" };
	}
	// An agent tool call is backend use: the pause sweep must not pause this
	// backend. The stamp is a hint, so its failure never fails the tool.
	try {
		await deps.backends.touchActive(projectId);
	} catch (error) {
		deps.logger.warn("backend.touch-failed", {
			message: getErrorMessage(error),
			projectId,
		});
	}
	return {
		backend: { projectId, ref: row.ref },
		backendId: row.id,
		client: deps.client,
	};
}

/** Turns an error of a tool body into the failure the agent reads. */
export function mapClientError(error: unknown): BackendToolFailure {
	// The rate-limit error extends the management error, so it goes first.
	if (error instanceof SupabaseRateLimitedError) {
		// The limiter counts milliseconds; the agent reads whole seconds.
		return {
			retryAfterSeconds: Math.ceil(error.retryAfterMs / 1000),
			status: "rate_limited",
		};
	}
	if (error instanceof SupabaseManagementError) {
		return {
			reason: error.detail ?? "Supabase did not answer",
			status: "failed",
		};
	}
	return { reason: "The tool failed on the server", status: "failed" };
}

/**
 * Runs one tool call: parses the input, resolves the active backend, and
 * runs `body`. It turns every error into a typed failure. So a tool never
 * throws to the agent. One `host-tool.backend` info line per call holds the
 * tool, the ref, the status, and the duration.
 */
export async function runBackendTool<
	TInput extends Record<string, unknown>,
	TOutput extends { status: string },
>(
	deps: BackendToolDeps,
	context: HostToolContext,
	call: {
		/** The tool name; the log line carries it. */
		tool: BackendToolName;
		/** The input schema of the tool, from `@wandit/contracts`. */
		inputSchema: z.ZodType<TInput>;
		/** The input the harness passes: the JSON of the model, not parsed yet. */
		input: unknown;
	},
	body: (active: ActiveBackend, input: TInput) => Promise<TOutput>,
): Promise<TOutput | BackendToolFailure> {
	const { tool } = call;
	const startedAt = performance.now();
	// Null until the backend resolves; the log line shows which call reached Supabase.
	let ref: string | null = null;
	let output: TOutput | BackendToolFailure;
	try {
		// Security check: the harness runs `execute` with the raw input and
		// does not parse it with `inputSchema`, so the tool parses it here.
		const parsed = call.inputSchema.safeParse(call.input);
		if (!parsed.success) {
			output = {
				reason: `The input is not valid. ${z.prettifyError(parsed.error)}`,
				status: "failed",
			};
		} else {
			const active = await resolveActiveBackend(deps, context.projectId);
			if ("status" in active) {
				output = active;
			} else {
				ref = active.backend.ref;
				output = await body(active, parsed.data);
			}
		}
	} catch (error) {
		deps.logger.warn("host-tool.backend.failed", {
			message: getErrorMessage(error),
			projectId: context.projectId,
			tool,
		});
		output = mapClientError(error);
	}
	deps.logger.info("host-tool.backend", {
		durationMs: Math.round(performance.now() - startedAt),
		projectId: context.projectId,
		ref,
		status: output.status,
		tool,
	});
	return output;
}
