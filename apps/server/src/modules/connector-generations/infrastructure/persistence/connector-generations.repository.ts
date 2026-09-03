/**
 * Database helper for connector-generation attempts (background MCP media
 * generations, e.g. Higgsfield video). Two callers share it — the chat
 * agent's generation intercept (queue-time writes) and the HTTP read
 * endpoint. The Trigger.dev task does NOT use this class: it runs outside
 * Nest and talks to the same table through createDb(), like the other tasks.
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, lt, ne, or, sql } from "@wandit/db";
import { connectorGenerationAttempts } from "@wandit/db/schema/connector-generation-attempts";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { captureGenerationFailed } from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	captureAiError,
	classifyAiError,
	type NormalizedAiError,
	renderAiErrorSentence,
} from "../../../ai-errors/domain";
import type { ProjectScope } from "../../../projects/domain/project-scope";

export type ConnectorGenerationAttemptRow = {
	id: string;
	userId: string;
	/** Payer snapshot: org pool when queued from an org workspace. */
	organizationId: string | null;
	connectorSlug: string;
	toolName: string;
	args: unknown;
	status: "queued" | "running" | "succeeded" | "failed";
	media: unknown;
	error: string | null;
	failureKind: string | null;
	failureSource: string | null;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	sentryEventId: string | null;
	createdAt: Date;
	completedAt: Date | null;
};

// Most connector tasks can wait five minutes before starting a 30-minute
// task. Keep three minutes for final billing + DB commit. Personal Clipper can
// run for 60 minutes, so only its rows receive the longer window.
export const CONNECTOR_ATTEMPT_STALE_MS = 38 * 60 * 1000;
export const PERSONAL_CLIPPER_ATTEMPT_STALE_MS = 68 * 60 * 1000;

@Injectable()
export class ConnectorGenerationsRepository {
	constructor(
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	// One attempt row per intercepted generation REQUEST: a duplicated tool
	// call (same chatId + requestKey) lands on the existing row instead of a
	// second generation. chatId NULL disables the dedupe by design (NULLs are
	// distinct); the Trigger-side idempotency key stays the second guard.
	async insertAttempt(input: {
		userId: string;
		organizationId: string | null;
		chatId: string | null;
		requestKey: string;
		connectorSlug: string;
		toolName: string;
		args: unknown;
	}): Promise<{
		created: boolean;
		id: string;
		status: ConnectorGenerationAttemptRow["status"];
	}> {
		const [row] = await this.db
			.insert(connectorGenerationAttempts)
			.values(input)
			.onConflictDoNothing({
				target: [
					connectorGenerationAttempts.chatId,
					connectorGenerationAttempts.requestKey,
				],
			})
			.returning({
				id: connectorGenerationAttempts.id,
				status: connectorGenerationAttempts.status,
			});

		if (row) {
			return { ...row, created: true };
		}

		const [existing] = await this.db
			.select({
				id: connectorGenerationAttempts.id,
				status: connectorGenerationAttempts.status,
			})
			.from(connectorGenerationAttempts)
			.where(
				and(
					input.chatId === null
						? isNull(connectorGenerationAttempts.chatId)
						: eq(connectorGenerationAttempts.chatId, input.chatId),
					eq(connectorGenerationAttempts.requestKey, input.requestKey),
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				"Connector generation idempotency conflict did not return an attempt",
			);
		}

		return { ...existing, created: false };
	}

	async markAttemptTriggered(
		attemptId: string,
		triggerRunId: string,
	): Promise<void> {
		await this.db
			.update(connectorGenerationAttempts)
			.set({ triggerRunId })
			.where(eq(connectorGenerationAttempts.id, attemptId));
	}

	async markAttemptFailed(attemptId: string, error: unknown): Promise<boolean> {
		const normalized = connectorInfrastructureFailure(error);
		const [failed] = await this.db
			.update(connectorGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: renderAiErrorSentence(normalized),
				failureKind: normalized.kind,
				failureProvider: normalized.provider,
				failureProviderMessage: normalized.providerMessage,
				failureRequestId: normalized.requestId,
				failureSource: normalized.source,
				sentryEventId: normalized.sentryEventId,
				status: "failed",
			})
			.where(
				and(
					eq(connectorGenerationAttempts.id, attemptId),
					eq(connectorGenerationAttempts.status, "queued"),
				),
			)
			.returning({
				id: connectorGenerationAttempts.id,
				userId: connectorGenerationAttempts.userId,
			});

		if (!failed) {
			return false;
		}
		normalized.sentryEventId = captureAiError(error, normalized, {
			generationId: failed.id,
			route: "none",
			surface: "connector",
			userId: failed.userId,
		});
		if (normalized.sentryEventId) {
			try {
				await this.db
					.update(connectorGenerationAttempts)
					.set({ sentryEventId: normalized.sentryEventId })
					.where(eq(connectorGenerationAttempts.id, failed.id));
			} catch {
				// The terminal row already won its CAS. A failed observability-link
				// write must not keep its associated hold open.
			}
		}

		captureGenerationFailed(
			this.analyticsService,
			failed.userId,
			"connector",
			null,
			failed.id,
			"trigger_rejected",
		);

		return true;
	}

	// Generated-asset markers for the model-bound transcript: only settled,
	// successful attempts with media, and only ids that came from the chat's
	// own tool parts (the scope filter is defense in depth, not discovery).
	// Same payer-snapshot semantics as findAccessibleAttempt below — in a
	// shared org chat, a teammate's transcript must resolve the markers of an
	// attempt another member queued.
	async listSucceededByIdsForScope(
		scope: ProjectScope,
		attemptIds: readonly string[],
	): Promise<Array<Pick<ConnectorGenerationAttemptRow, "id" | "media">>> {
		if (attemptIds.length === 0) {
			return [];
		}

		const scopePredicate =
			scope.kind === "personal"
				? and(
						eq(connectorGenerationAttempts.userId, scope.userId),
						isNull(connectorGenerationAttempts.organizationId),
					)
				: eq(connectorGenerationAttempts.organizationId, scope.organizationId);

		return this.db
			.select({
				id: connectorGenerationAttempts.id,
				media: connectorGenerationAttempts.media,
			})
			.from(connectorGenerationAttempts)
			.where(
				and(
					inArray(connectorGenerationAttempts.id, [...attemptIds]),
					scopePredicate,
					eq(connectorGenerationAttempts.status, "succeeded"),
				),
			);
	}

	// Ownership is by user id (the MCP connection is per-user). Missing and
	// not-owned are indistinguishable to the caller on purpose.
	// Mirrors projectScopePredicate semantics on the attempt's own payer
	// snapshot: personal = creator equality, org = workspace membership (the
	// guard proved it) — so a teammate polling a shared org chat's card is
	// not 404'd just because another member queued the generation.
	async findAccessibleAttempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<ConnectorGenerationAttemptRow | null> {
		await this.settleStaleAttempt(attemptId);

		const scopePredicate =
			scope.kind === "personal"
				? and(
						eq(connectorGenerationAttempts.userId, scope.userId),
						isNull(connectorGenerationAttempts.organizationId),
					)
				: eq(connectorGenerationAttempts.organizationId, scope.organizationId);

		const [row] = await this.db
			.select()
			.from(connectorGenerationAttempts)
			.where(and(eq(connectorGenerationAttempts.id, attemptId), scopePredicate))
			.limit(1);

		return row ?? null;
	}

	async listRunningCompletionCheckpoints(
		limit = 100,
	): Promise<ConnectorGenerationAttemptRow[]> {
		if (!Number.isInteger(limit) || limit <= 0) {
			throw new Error("Connector recovery limit must be a positive integer");
		}

		return this.db
			.select()
			.from(connectorGenerationAttempts)
			.where(
				and(
					eq(connectorGenerationAttempts.status, "running"),
					sql`${connectorGenerationAttempts.media} is not null`,
				),
			)
			.limit(limit);
	}

	async markRunningAttemptSucceeded(attemptId: string): Promise<boolean> {
		const [completed] = await this.db
			.update(connectorGenerationAttempts)
			.set({ completedAt: new Date(), error: null, status: "succeeded" })
			.where(
				and(
					eq(connectorGenerationAttempts.id, attemptId),
					eq(connectorGenerationAttempts.status, "running"),
					sql`${connectorGenerationAttempts.media} is not null`,
				),
			)
			.returning({ id: connectorGenerationAttempts.id });

		return completed !== undefined;
	}

	// Read-time janitor: a queued/running row this old is an orphaned run
	// (worker crash, lost handoff) — settle it so the card can conclude.
	private async settleStaleAttempt(attemptId: string): Promise<void> {
		const now = Date.now();
		const staleError = new Error("Connector generation attempt became stale");
		const normalized = connectorInfrastructureFailure(staleError);

		const [stale] = await this.db
			.update(connectorGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: "The generation stopped before finishing.",
				failureKind: normalized.kind,
				failureProvider: normalized.provider,
				failureProviderMessage: normalized.providerMessage,
				failureRequestId: normalized.requestId,
				failureSource: normalized.source,
				sentryEventId: normalized.sentryEventId,
				status: "failed",
			})
			.where(
				and(
					eq(connectorGenerationAttempts.id, attemptId),
					inArray(connectorGenerationAttempts.status, ["queued", "running"]),
					isNull(connectorGenerationAttempts.media),
					or(
						and(
							eq(
								connectorGenerationAttempts.toolName,
								"personal_clipper_create",
							),
							lt(
								connectorGenerationAttempts.createdAt,
								new Date(now - PERSONAL_CLIPPER_ATTEMPT_STALE_MS),
							),
						),
						and(
							ne(
								connectorGenerationAttempts.toolName,
								"personal_clipper_create",
							),
							lt(
								connectorGenerationAttempts.createdAt,
								new Date(now - CONNECTOR_ATTEMPT_STALE_MS),
							),
						),
					),
				),
			)
			.returning({
				id: connectorGenerationAttempts.id,
				toolName: connectorGenerationAttempts.toolName,
				userId: connectorGenerationAttempts.userId,
			});

		if (!stale) return;
		normalized.sentryEventId = captureAiError(staleError, normalized, {
			generationId: stale.id,
			route: "none",
			surface: "connector",
			toolName: stale.toolName,
			userId: stale.userId,
		});
		if (normalized.sentryEventId) {
			try {
				await this.db
					.update(connectorGenerationAttempts)
					.set({ sentryEventId: normalized.sentryEventId })
					.where(eq(connectorGenerationAttempts.id, stale.id));
			} catch {
				// The stale row is already terminal; keep the read path available when
				// only the optional Sentry link could not be persisted.
			}
		}
	}
}

function connectorInfrastructureFailure(error: unknown): NormalizedAiError {
	return (
		classifyAiError(error, {
			route: "none",
			surface: "connector",
		}) ??
		(classifyAiError(new Error("Connector generation failed"), {
			route: "none",
			surface: "connector",
		}) as NormalizedAiError)
	);
}
