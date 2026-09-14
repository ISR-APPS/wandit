/**
 * Repository for the `builder_turns` table.
 * `turns.service.ts` and `turn-promotion.ts` call it in the API process;
 * the `builder-turn` task (WANDIT-166) calls the CAS methods inside a run.
 * The partial unique index `builder_turns_active_project_uq` is the last
 * guard of the one-active-turn-per-project rule; every mutator is a CAS so
 * a stale writer can never overwrite a newer state.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
	BuilderTurnStatus,
	ComposerMetadata,
	FileRef,
} from "@wandit/contracts";
import { and, asc, eq, inArray, notInArray, sql } from "@wandit/db";
import { builderTurns } from "@wandit/db/schema/builder-turns";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { BuilderTurnActiveError } from "../../domain/errors/builder-turn-active.error";
import type { HarnessKind } from "../../domain/ports/builder-harness";
import {
	CHAT_ACTIVE_TURN_STATUSES,
	PROJECT_ACTIVE_TURN_STATUSES,
	TERMINAL_TURN_STATUSES,
} from "../../domain/turn-queue";

/** One `builder_turns` row. */
export type BuilderTurnRow = typeof builderTurns.$inferSelect;

/**
 * The frozen request snapshot stored in `spec` at queue time. The task
 * reads it back; later edits of the chat never change what a turn meant.
 */
export type BuilderTurnSpec = {
	/** Attachment refs the user sent with the prompt, in composer order. */
	attachments: FileRef[];
	/** Composer metadata (mode, skills); null when the user sent none. */
	composer: ComposerMetadata | null;
	/** The user prompt text; may be empty when attachments carry the turn. */
	message: string;
};

/** Mutable columns `transition` may patch besides `status` itself. */
export type BuilderTurnPatch = Partial<
	Pick<
		BuilderTurnRow,
		| "cacheReadTokens"
		| "cacheWriteTokens"
		| "completedAt"
		| "credits"
		| "error"
		| "failureCode"
		| "failureKind"
		| "failureProvider"
		| "failureProviderMessage"
		| "failureRequestId"
		| "failureSource"
		| "harness"
		| "inputCommitSha"
		| "inputTokens"
		| "model"
		| "outputCommitSha"
		| "outputTokens"
		| "sentryEventId"
		| "sessionId"
		| "startedAt"
		| "triggerRunId"
	>
>;

/** Failure details the task records when a turn dies. */
export type BuilderTurnFailure = {
	/** Human-readable reason shown on the turn card. */
	error: string;
	failureCode: string | null;
	failureKind: string | null;
	failureProvider: string | null;
	failureProviderMessage: string | null;
	failureRequestId: string | null;
	failureSource: string | null;
	sentryEventId: string | null;
};

/** Usage numbers the task reports back for settlement (WANDIT-174). */
export type BuilderTurnUsage = {
	cacheReadTokens: number;
	cacheWriteTokens: number;
	/** Settled cost so far, in centi-credits (1 credit = 100 cc). */
	credits: number;
	harness: HarnessKind;
	inputTokens: number;
	model: string | null;
	outputTokens: number;
};

@Injectable()
export class BuilderTurnsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts one turn row and allocates `turnNumber = max + 1` per project.
	 * The `SELECT ... FOR UPDATE` on the project row serializes allocation:
	 * two concurrent creates of one project cannot read the same max.
	 * `replayed` is true when `(chatId, requestKey)` already existed — a
	 * retried submit adopts the earlier row instead of making a twin.
	 * Throws `BuilderTurnActiveError` when the active-slot index rejects a
	 * `queued` insert.
	 */
	async create(input: {
		chatId: string;
		harness: HarnessKind;
		/** Server-generated uuid; the caller needs it before the row exists
		 * for the metering idempotency key. */
		id: string;
		messageId: string;
		model: string | null;
		organizationId: string | null;
		projectId: string;
		/** Dedupe key of the submit; today it is the generated turn id. */
		requestKey: string;
		sessionId: string;
		spec: BuilderTurnSpec;
		status: "queued" | "waiting";
		userId: string;
	}): Promise<{ replayed: boolean; turn: BuilderTurnRow }> {
		try {
			const turn = await this.db.transaction(async (tx) => {
				// Serialize turn-number allocation per project on the project row.
				await tx
					.select({ id: projects.id })
					.from(projects)
					.where(eq(projects.id, input.projectId))
					.for("update");

				const [maxRow] = await tx
					.select({
						max: sql<number>`coalesce(max(${builderTurns.turnNumber}), 0)::int`,
					})
					.from(builderTurns)
					.where(eq(builderTurns.projectId, input.projectId));

				const [row] = await tx
					.insert(builderTurns)
					.values({
						chatId: input.chatId,
						harness: input.harness,
						id: input.id,
						messageId: input.messageId,
						model: input.model,
						organizationId: input.organizationId,
						projectId: input.projectId,
						requestKey: input.requestKey,
						sessionId: input.sessionId,
						spec: input.spec,
						status: input.status,
						turnNumber: (maxRow?.max ?? 0) + 1,
						userId: input.userId,
					})
					.returning();

				if (!row) {
					throw new Error("Builder turn insert did not return a row");
				}

				return row;
			});

			return { replayed: false, turn };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// The (chatId, requestKey) index proves this submit ran before:
			// adopt the existing row so a retried POST is idempotent.
			const existing = await this.findByRequestKey(
				input.chatId,
				input.requestKey,
			);
			if (existing) {
				return { replayed: true, turn: existing };
			}

			// The only remaining unique write the insert touches is the
			// active-project index: a queued row landed while the slot was
			// taken (or a promotion raced us).
			throw new BuilderTurnActiveError();
		}
	}

	/** The row, or null. Callers check `projectId` for cross-project access. */
	async findById(turnId: string): Promise<BuilderTurnRow | null> {
		const [row] = await this.db
			.select()
			.from(builderTurns)
			.where(eq(builderTurns.id, turnId))
			.limit(1);

		return row ?? null;
	}

	/** The row holding a Trigger.dev run id, used by run-side callbacks. */
	async findByTriggerRunId(runId: string): Promise<BuilderTurnRow | null> {
		const [row] = await this.db
			.select()
			.from(builderTurns)
			.where(eq(builderTurns.triggerRunId, runId))
			.limit(1);

		return row ?? null;
	}

	/** The row a retried submit produced, or null. */
	async findByRequestKey(
		chatId: string,
		requestKey: string,
	): Promise<BuilderTurnRow | null> {
		const [row] = await this.db
			.select()
			.from(builderTurns)
			.where(
				and(
					eq(builderTurns.chatId, chatId),
					eq(builderTurns.requestKey, requestKey),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/** The single active row of a project (queued/running/cancelling). */
	async findActiveForProject(
		projectId: string,
	): Promise<BuilderTurnRow | null> {
		const [row] = await this.db
			.select()
			.from(builderTurns)
			.where(
				and(
					eq(builderTurns.projectId, projectId),
					inArray(builderTurns.status, [...PROJECT_ACTIVE_TURN_STATUSES]),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/**
	 * All non-terminal rows of one chat, including parked `waiting` rows.
	 * The history filter uses it to hide in-flight assistant messages.
	 */
	async findActiveForChat(chatId: string): Promise<BuilderTurnRow[]> {
		return this.db
			.select()
			.from(builderTurns)
			.where(
				and(
					eq(builderTurns.chatId, chatId),
					inArray(builderTurns.status, [...CHAT_ACTIVE_TURN_STATUSES]),
				),
			);
	}

	/**
	 * The oldest parked `waiting` row of a project, or null. `create` reads
	 * it before the lock so a new submit parks behind a stranded queue
	 * instead of jumping it.
	 */
	async findOldestWaiting(projectId: string): Promise<BuilderTurnRow | null> {
		const [row] = await this.db
			.select()
			.from(builderTurns)
			.where(
				and(
					eq(builderTurns.projectId, projectId),
					eq(builderTurns.status, "waiting"),
				),
			)
			.orderBy(asc(builderTurns.turnNumber))
			.limit(1);

		return row ?? null;
	}

	/**
	 * CAS `queued` → `running`; also binds the Trigger run id. The run id
	 * clause accepts the API-written id so a claim after `setTriggerRunId`
	 * still lands; a foreign run id can never claim the row.
	 */
	async claimRunning(turnId: string, triggerRunId: string): Promise<boolean> {
		const [row] = await this.db
			.update(builderTurns)
			.set({
				startedAt: new Date(),
				status: "running",
				triggerRunId,
			})
			.where(
				and(
					eq(builderTurns.id, turnId),
					eq(builderTurns.status, "queued"),
					sql`(${builderTurns.triggerRunId} is null or ${builderTurns.triggerRunId} = ${triggerRunId})`,
				),
			)
			.returning({ id: builderTurns.id });

		return row !== undefined;
	}

	/**
	 * Generic CAS: sets `to` and `patch` only while the row sits in `from`.
	 * Returns false when the row moved on — the caller then re-reads truth.
	 * A move into an active status can hit `builder_turns_active_project_uq`
	 * when another row took the slot first. That 23505 is a lost CAS, so
	 * the method answers false instead of a 500.
	 */
	async transition(
		turnId: string,
		from: BuilderTurnStatus[],
		to: BuilderTurnStatus,
		patch?: BuilderTurnPatch,
	): Promise<boolean> {
		try {
			const [row] = await this.db
				.update(builderTurns)
				.set({ ...patch, status: to })
				.where(
					and(eq(builderTurns.id, turnId), inArray(builderTurns.status, from)),
				)
				.returning({ id: builderTurns.id });

			return row !== undefined;
		} catch (error) {
			if (isUniqueViolation(error)) {
				return false;
			}
			throw error;
		}
	}

	/** Stores the run id the trigger call returned. No CAS: the API writes
	 * this once, right after `tasks.trigger` answers. */
	async setTriggerRunId(turnId: string, runId: string): Promise<void> {
		await this.db
			.update(builderTurns)
			.set({ triggerRunId: runId })
			.where(eq(builderTurns.id, turnId));
	}

	/**
	 * Usage payload write. Unconditional on purpose: a canceled turn still
	 * reports real usage for settlement. Lifecycle fencing lives in the CAS
	 * methods and in `assertCurrentTurn`, which the task runs before writes.
	 */
	async recordUsage(turnId: string, usage: BuilderTurnUsage): Promise<void> {
		await this.db
			.update(builderTurns)
			.set({
				cacheReadTokens: usage.cacheReadTokens,
				cacheWriteTokens: usage.cacheWriteTokens,
				credits: usage.credits,
				harness: usage.harness,
				inputTokens: usage.inputTokens,
				model: usage.model,
				outputTokens: usage.outputTokens,
			})
			.where(eq(builderTurns.id, turnId));
	}

	/**
	 * Terminal write of a finished run. CAS from `running` or `cancelling`
	 * (a cancel may still let the task commit its wip state first).
	 */
	async complete(
		turnId: string,
		input: {
			completedAt: Date;
			outputCommitSha: string | null;
			status: BuilderTurnStatus;
		},
	): Promise<boolean> {
		const [row] = await this.db
			.update(builderTurns)
			.set({
				completedAt: input.completedAt,
				outputCommitSha: input.outputCommitSha,
				status: input.status,
			})
			.where(
				and(
					eq(builderTurns.id, turnId),
					inArray(builderTurns.status, ["running", "cancelling"]),
				),
			)
			.returning({ id: builderTurns.id });

		return row !== undefined;
	}

	/**
	 * Terminal write of a dead run. CAS from any non-terminal status so a
	 * late `fail` can never resurrect a settled row.
	 */
	async fail(turnId: string, failure: BuilderTurnFailure): Promise<boolean> {
		const [row] = await this.db
			.update(builderTurns)
			.set({
				completedAt: new Date(),
				error: failure.error,
				failureCode: failure.failureCode,
				failureKind: failure.failureKind,
				failureProvider: failure.failureProvider,
				failureProviderMessage: failure.failureProviderMessage,
				failureRequestId: failure.failureRequestId,
				failureSource: failure.failureSource,
				sentryEventId: failure.sentryEventId,
				status: "failed",
			})
			.where(
				and(
					eq(builderTurns.id, turnId),
					notInArray(builderTurns.status, [...TERMINAL_TURN_STATUSES]),
				),
			)
			.returning({ id: builderTurns.id });

		return row !== undefined;
	}

	/**
	 * Moves the oldest `waiting` row of a project to `queued` and returns it.
	 * Returns null when no row waits or when the active slot is still taken —
	 * the 23505 of `builder_turns_active_project_uq` then lands here.
	 */
	async promoteOldestWaiting(
		projectId: string,
	): Promise<BuilderTurnRow | null> {
		try {
			const oldestWaiting = this.db
				.select({ id: builderTurns.id })
				.from(builderTurns)
				.where(
					and(
						eq(builderTurns.projectId, projectId),
						eq(builderTurns.status, "waiting"),
					),
				)
				.orderBy(asc(builderTurns.turnNumber))
				.limit(1);

			// The extra status='waiting' clause re-checks under the subquery:
			// a row that flipped between the read and the write stays put.
			const [row] = await this.db
				.update(builderTurns)
				.set({ status: "queued" })
				.where(
					and(
						eq(builderTurns.id, oldestWaiting),
						eq(builderTurns.status, "waiting"),
					),
				)
				.returning();

			return row ?? null;
		} catch (error) {
			if (isUniqueViolation(error)) {
				// An active row exists: the slot was not free after all.
				return null;
			}
			throw error;
		}
	}

	/** Highest allocated turn number of a project; 0 before the first turn. */
	async currentTurnNumber(projectId: string): Promise<number> {
		const [row] = await this.db
			.select({
				max: sql<number>`coalesce(max(${builderTurns.turnNumber}), 0)::int`,
			})
			.from(builderTurns)
			.where(eq(builderTurns.projectId, projectId));

		return row?.max ?? 0;
	}
}

/**
 * Postgres unique_violation (23505) probe. Drizzle wraps the driver error,
 * so the check walks the cause chain rather than trusting one shape.
 * Shared with `turns.service.ts` for the session-create race.
 */
export function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;

	// LIMIT: 5 causes. Upgrade: loop until no cause.
	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (
			typeof current === "object" &&
			current !== null &&
			"code" in current &&
			current.code === "23505"
		) {
			return true;
		}
		current =
			typeof current === "object" && current !== null && "cause" in current
				? current.cause
				: undefined;
	}

	return false;
}
