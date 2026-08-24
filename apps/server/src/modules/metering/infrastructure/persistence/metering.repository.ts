import { isDeepStrictEqual } from "node:util";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "@wandit/db";
import { connectorGenerationAttempts } from "@wandit/db/schema/connector-generation-attempts";
import {
	aiProviderCallEvidence,
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type {
	AiProviderCallEvidence,
	ProviderCallEvidenceCost,
	ProviderCallEvidenceInput,
} from "../../domain/provider-call-evidence";

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
		| "executionLeaseExpiresAt"
		| "executionLeaseToken"
		| "finalCredits"
		| "inputTokens"
		| "model"
		| "nextReconcileAttemptAt"
		| "outputTokens"
		| "pricingSnapshot"
		| "provider"
		| "rawUsage"
		| "reconcileAttempts"
		| "reconciledAt"
		| "reconciledCostUsdMicros"
		| "settledAt"
		| "status"
	>
>;

const PERSONAL_CLIPPER_RESERVATION_STALE_EXTENSION_MS = 30 * 60_000;

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

	async listProviderCallEvidence(
		usageEventId: string,
		client: MeteringDbClient = this.db,
	): Promise<AiProviderCallEvidence[]> {
		return client
			.select()
			.from(aiProviderCallEvidence)
			.where(eq(aiProviderCallEvidence.usageEventId, usageEventId))
			.orderBy(
				asc(aiProviderCallEvidence.createdAt),
				asc(aiProviderCallEvidence.id),
			);
	}

	async findProviderCallEvidenceById(
		evidenceId: string,
		client: MeteringDbClient = this.db,
	): Promise<AiProviderCallEvidence | null> {
		const [row] = await client
			.select()
			.from(aiProviderCallEvidence)
			.where(eq(aiProviderCallEvidence.id, evidenceId))
			.limit(1);

		return row ?? null;
	}

	/** Idempotent on `idempotencyKey`: a replay returns the existing row. */
	async insertProviderCallEvidence(
		input: ProviderCallEvidenceInput & { usageEventId: string },
		client: MeteringDbClient = this.db,
	): Promise<AiProviderCallEvidence> {
		const [inserted] = await client
			.insert(aiProviderCallEvidence)
			.values({
				chargedUsdMicros: input.chargedUsdMicros ?? null,
				costSource: input.costSource ?? null,
				costStatus: input.costStatus,
				customerBillable: input.customerBillable,
				idempotencyKey: input.idempotencyKey,
				providerRequestId: input.providerRequestId ?? null,
				rateUsdMicrosPerUnit: input.rateUsdMicrosPerUnit ?? null,
				rawReceipt: input.rawReceipt ?? null,
				transport: input.transport,
				unitKind: input.unitKind,
				units: input.units,
				usageEventId: input.usageEventId,
			})
			.onConflictDoNothing({ target: aiProviderCallEvidence.idempotencyKey })
			.returning();

		if (inserted) {
			return inserted;
		}

		const [existing] = await client
			.select()
			.from(aiProviderCallEvidence)
			.where(eq(aiProviderCallEvidence.idempotencyKey, input.idempotencyKey))
			.limit(1);

		if (!existing) {
			throw new Error(
				`Provider call evidence ${input.idempotencyKey} disappeared after conflict`,
			);
		}

		if (existing.usageEventId !== input.usageEventId) {
			throw new Error(
				`Provider call evidence ${input.idempotencyKey} is already attached to another usage event`,
			);
		}

		return existing;
	}

	async updateProviderCallEvidenceCost(
		evidenceId: string,
		cost: ProviderCallEvidenceCost & { units: number },
		client: MeteringDbClient = this.db,
	): Promise<AiProviderCallEvidence> {
		const [updated] = await client
			.update(aiProviderCallEvidence)
			.set({
				chargedUsdMicros: cost.chargedUsdMicros,
				costSource: cost.costSource ?? null,
				costStatus: cost.costStatus,
				rateUsdMicrosPerUnit: cost.rateUsdMicrosPerUnit ?? null,
				...(cost.rawReceipt === undefined
					? {}
					: { rawReceipt: cost.rawReceipt }),
				units: cost.units,
				updatedAt: new Date(),
			})
			.where(eq(aiProviderCallEvidence.id, evidenceId))
			.returning();

		if (!updated) {
			throw new Error(
				`Provider call evidence ${evidenceId} disappeared during cost settlement`,
			);
		}

		return updated;
	}

	/**
	 * Cross-replica execution lease: single-statement compare-and-set, safe
	 * across replicas without advisory locks. Succeeds only on a still-reserved
	 * event whose lease is absent or expired; exactly one racer wins.
	 */
	async acquireExecutionLease(
		eventId: string,
		token: string,
		ttlMs: number,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow | null> {
		const [leased] = await client
			.update(aiUsageEvents)
			.set({
				executionLeaseExpiresAt: this.leaseExpiry(ttlMs),
				executionLeaseToken: token,
			})
			.where(
				and(
					eq(aiUsageEvents.id, eventId),
					eq(aiUsageEvents.status, "reserved"),
					or(
						isNull(aiUsageEvents.executionLeaseToken),
						lt(aiUsageEvents.executionLeaseExpiresAt, sql`now()`),
					),
				),
			)
			.returning();

		return leased ?? null;
	}

	/** Token CAS: extends the lease only while this holder still owns it. */
	async heartbeatExecutionLease(
		eventId: string,
		token: string,
		ttlMs: number,
		client: MeteringDbClient = this.db,
	): Promise<boolean> {
		const [renewed] = await client
			.update(aiUsageEvents)
			.set({ executionLeaseExpiresAt: this.leaseExpiry(ttlMs) })
			.where(
				and(
					eq(aiUsageEvents.id, eventId),
					eq(aiUsageEvents.status, "reserved"),
					eq(aiUsageEvents.executionLeaseToken, token),
				),
			)
			.returning({ id: aiUsageEvents.id });

		return renewed !== undefined;
	}

	/** Token CAS: clears both lease columns when this holder still owns it. */
	async releaseExecutionLease(
		eventId: string,
		token: string,
		client: MeteringDbClient = this.db,
	): Promise<void> {
		await client
			.update(aiUsageEvents)
			.set({ executionLeaseExpiresAt: null, executionLeaseToken: null })
			.where(
				and(
					eq(aiUsageEvents.id, eventId),
					eq(aiUsageEvents.executionLeaseToken, token),
				),
			);
	}

	listStaleReserved(
		createdBefore: Date,
		limit: number,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow[]> {
		const personalClipperCreatedBefore = new Date(
			createdBefore.getTime() - PERSONAL_CLIPPER_RESERVATION_STALE_EXTENSION_MS,
		);

		return client
			.select()
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.status, "reserved"),
					lt(aiUsageEvents.createdAt, createdBefore),
					// The scheduled sweep passes the normal 40-minute cutoff. Only a
					// reservation tied to a still-running Personal Clipper attempt gets
					// the additional 30 minutes; all other rows remain selectable.
					or(
						lt(aiUsageEvents.createdAt, personalClipperCreatedBefore),
						sql`not exists (
							select 1
							from ${connectorGenerationAttempts}
							where ${connectorGenerationAttempts.id}::text = ${aiUsageEvents.attemptRef}
								and ${connectorGenerationAttempts.status} = ${"running"}
								and ${connectorGenerationAttempts.toolName} = ${"personal_clipper_create"}
						)`,
					),
					// Never refund a hold whose stream is provably live on another
					// replica: an unexpired execution lease excludes the row.
					or(
						isNull(aiUsageEvents.executionLeaseExpiresAt),
						lt(aiUsageEvents.executionLeaseExpiresAt, sql`now()`),
					),
				),
			)
			.orderBy(asc(aiUsageEvents.createdAt), asc(aiUsageEvents.id))
			.limit(limit);
	}

	/** Due reconcile_failed retries; dead-lettered rows carry NULL and never match. */
	listRetryableReconcileFailed(
		now: Date,
		limit: number,
		client: MeteringDbClient = this.db,
	): Promise<AiUsageEventRow[]> {
		return client
			.select()
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.status, "reconcile_failed"),
					lte(aiUsageEvents.nextReconcileAttemptAt, now),
				),
			)
			.orderBy(asc(aiUsageEvents.nextReconcileAttemptAt), asc(aiUsageEvents.id))
			.limit(limit);
	}

	/**
	 * Settled events with NO generation refs at all — invisible to
	 * listUnreconciledSettled's EXISTS clause. reconcile() finalizes them from
	 * the settlement evidence once they are old enough for late capture to win.
	 */
	listSettledWithoutRefs(
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
					sql<boolean>`not exists (
						select 1
						from ${aiUsageGenerationRefs}
						where ${aiUsageGenerationRefs.usageEventId} = ${aiUsageEvents.id}
					)`,
				),
			)
			.orderBy(asc(aiUsageEvents.createdAt), asc(aiUsageEvents.id))
			.limit(limit);
	}

	private leaseExpiry(ttlMs: number) {
		if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
			throw new Error("Execution lease TTL must be a positive integer");
		}

		return sql<Date>`now() + (${ttlMs} * interval '1 millisecond')`;
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
