import { isDeepStrictEqual } from "node:util";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, lt, sql } from "@wandit/db";
import {
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type MeteringTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type MeteringDbClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

export type AiUsageEventRow = typeof aiUsageEvents.$inferSelect;
export type AiUsageGenerationRefRow = typeof aiUsageGenerationRefs.$inferSelect;
export type InsertAiUsageEvent = typeof aiUsageEvents.$inferInsert;

export type InsertAiUsageGenerationRef = Pick<
	typeof aiUsageGenerationRefs.$inferInsert,
	"gatewayGenerationId" | "providerSource" | "stepUsage" | "usageEventId"
>;

export type AiUsageEventPatch = Partial<
	Pick<
		AiUsageEventRow,
		| "cacheReadTokens"
		| "cacheWriteTokens"
		| "finalCredits"
		| "inputTokens"
		| "model"
		| "outputTokens"
		| "pricingSnapshot"
		| "provider"
		| "rawUsage"
		| "reconciledAt"
		| "reconciledCostUsdMicros"
		| "settledAt"
		| "status"
	>
>;

@Injectable()
export class MeteringRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	transaction<T>(
		fn: (transaction: MeteringTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(fn);
	}

	async acquireOperationLock(
		operationKey: string,
		transaction: MeteringTransaction,
	): Promise<void> {
		await transaction.execute(
			sql`select pg_advisory_xact_lock(hashtext(${operationKey}))`,
		);
	}

	async findEventById(
		eventId: string,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow | null> {
		const [row] = await client
			.select()
			.from(aiUsageEvents)
			.where(eq(aiUsageEvents.id, eventId))
			.limit(1);

		return row ?? null;
	}

	async findEventByIdempotencyKey(
		idempotencyKey: string,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow | null> {
		const [row] = await client
			.select()
			.from(aiUsageEvents)
			.where(eq(aiUsageEvents.idempotencyKey, idempotencyKey))
			.limit(1);

		return row ?? null;
	}

	async insertEvent(
		input: InsertAiUsageEvent,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow> {
		const [inserted] = await client
			.insert(aiUsageEvents)
			.values(input)
			.onConflictDoNothing({ target: aiUsageEvents.idempotencyKey })
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findEventByIdempotencyKey(
			input.idempotencyKey,
			client,
		);

		if (!existing) {
			throw new Error(
				`AI usage event ${input.idempotencyKey} disappeared after conflict`,
			);
		}

		return existing;
	}

	async updateEvent(
		eventId: string,
		expectedStatuses: readonly AiUsageEventRow["status"][],
		patch: AiUsageEventPatch,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow | null> {
		if (expectedStatuses.length === 0) {
			throw new Error("AI usage event update requires an expected status");
		}

		const [updated] = await client
			.update(aiUsageEvents)
			.set(patch)
			.where(
				and(
					eq(aiUsageEvents.id, eventId),
					inArray(aiUsageEvents.status, [...expectedStatuses]),
				),
			)
			.returning();

		return updated ?? null;
	}

	async transitionEventAttemptRef(
		eventId: string,
		expectedAttemptRef: string,
		nextAttemptRef: string,
		expectedStatuses: readonly AiUsageEventRow["status"][],
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow | null> {
		if (expectedStatuses.length === 0) {
			throw new Error("Attempt-ref transition requires an expected status");
		}

		const [updated] = await client
			.update(aiUsageEvents)
			.set({ attemptRef: nextAttemptRef })
			.where(
				and(
					eq(aiUsageEvents.id, eventId),
					inArray(aiUsageEvents.status, [...expectedStatuses]),
					eq(aiUsageEvents.attemptRef, expectedAttemptRef),
				),
			)
			.returning();

		return updated ?? null;
	}

	async listGenerationRefs(
		usageEventId: string,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageGenerationRefRow[]> {
		return client
			.select()
			.from(aiUsageGenerationRefs)
			.where(eq(aiUsageGenerationRefs.usageEventId, usageEventId))
			.orderBy(asc(aiUsageGenerationRefs.id));
	}

	async insertGenerationRef(
		input: InsertAiUsageGenerationRef,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageGenerationRefRow> {
		const [inserted] = await client
			.insert(aiUsageGenerationRefs)
			.values({
				gatewayGenerationId: input.gatewayGenerationId,
				providerSource: input.providerSource ?? "vercel",
				stepUsage: input.stepUsage ?? null,
				usageEventId: input.usageEventId,
			})
			.onConflictDoNothing({
				target: aiUsageGenerationRefs.gatewayGenerationId,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const [existing] = await client
			.select()
			.from(aiUsageGenerationRefs)
			.where(
				eq(
					aiUsageGenerationRefs.gatewayGenerationId,
					input.gatewayGenerationId,
				),
			)
			.limit(1);

		if (!existing) {
			throw new Error(
				`AI usage generation ${input.gatewayGenerationId} disappeared after conflict`,
			);
		}

		if (existing.usageEventId !== input.usageEventId) {
			throw new Error(
				`Gateway generation ${input.gatewayGenerationId} is already attached to another usage event`,
			);
		}

		const requestedStepUsage = input.stepUsage ?? null;

		// ID-only capture replays are intentionally weak assertions: they cannot
		// erase richer evidence already written by onStepEnd. When the first durable
		// capture had no usage, allow one monotonic enrichment under a compare-and-set.
		if (requestedStepUsage === null) {
			return existing;
		}

		if (existing.stepUsage === null) {
			const [enriched] = await client
				.update(aiUsageGenerationRefs)
				.set({ stepUsage: requestedStepUsage })
				.where(
					and(
						eq(aiUsageGenerationRefs.id, existing.id),
						isNull(aiUsageGenerationRefs.stepUsage),
					),
				)
				.returning();

			if (enriched) {
				return enriched;
			}

			const [current] = await client
				.select()
				.from(aiUsageGenerationRefs)
				.where(eq(aiUsageGenerationRefs.id, existing.id))
				.limit(1);

			if (!current) {
				throw new Error(
					`AI usage generation ${input.gatewayGenerationId} disappeared during evidence enrichment`,
				);
			}

			if (generationStepUsageMatches(current.stepUsage, requestedStepUsage)) {
				return current;
			}
		}

		if (!generationStepUsageMatches(existing.stepUsage, requestedStepUsage)) {
			throw new Error(
				`Gateway generation ${input.gatewayGenerationId} has conflicting step usage`,
			);
		}

		return existing;
	}

	async updateGenerationRefStepUsage(
		generationRefId: string,
		stepUsage: unknown,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageGenerationRefRow> {
		const [updated] = await client
			.update(aiUsageGenerationRefs)
			.set({ stepUsage })
			.where(eq(aiUsageGenerationRefs.id, generationRefId))
			.returning();

		if (!updated) {
			throw new Error(
				`AI usage generation ref ${generationRefId} disappeared during evidence upgrade`,
			);
		}

		return updated;
	}

	async markGenerationRefReconciled(
		generationRefId: string,
		costUsdMicros: number,
		reconciledAt: Date,
		client: MeteringDbClient = this.db,
	): Promise<void> {
		const [updated] = await client
			.update(aiUsageGenerationRefs)
			.set({
				reconciledAt,
				reconciledCostUsdMicros: costUsdMicros,
			})
			.where(eq(aiUsageGenerationRefs.id, generationRefId))
			.returning({ id: aiUsageGenerationRefs.id });

		if (!updated) {
			throw new Error(
				`AI usage generation ref ${generationRefId} disappeared during reconciliation`,
			);
		}
	}

	listStaleReserved(
		createdBefore: Date,
		limit: number,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow[]> {
		return client
			.select()
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.status, "reserved"),
					lt(aiUsageEvents.createdAt, createdBefore),
				),
			)
			.orderBy(asc(aiUsageEvents.createdAt), asc(aiUsageEvents.id))
			.limit(limit);
	}

	listUnreconciledSettled(
		createdBefore: Date,
		limit: number,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow[]> {
		return client
			.select()
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.status, "settled"),
					lt(aiUsageEvents.createdAt, createdBefore),
					sql<boolean>`exists (
						select 1
						from ${aiUsageGenerationRefs}
						where ${aiUsageGenerationRefs.usageEventId} = ${aiUsageEvents.id}
							and ${aiUsageGenerationRefs.reconciledAt} is null
					)`,
				),
			)
			.orderBy(asc(aiUsageEvents.createdAt), asc(aiUsageEvents.id))
			.limit(limit);
	}
}

function generationStepUsageMatches(left: unknown, right: unknown): boolean {
	return isDeepStrictEqual(jsonbComparable(left), jsonbComparable(right));
}

function jsonbComparable(value: unknown): unknown {
	const serialized = JSON.stringify(value);

	return serialized === undefined ? null : JSON.parse(serialized);
}
