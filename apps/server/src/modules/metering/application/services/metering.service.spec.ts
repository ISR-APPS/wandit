import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type {
	CreditOwner,
	MeteringSubject,
} from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import { MemberCreditLimitError } from "../../../credits/domain/errors/member-credit-limit.error";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type { EnqueueLifecycleEvent } from "../../../lifecycle-events/domain/lifecycle-event";
import type {
	LifecycleEventRow,
	LifecycleEventsRepository,
	LifecycleEventsTransaction,
} from "../../../lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import type { OrganizationLimitsRepository } from "../../../workspaces/infrastructure/persistence/organization-limits.repository";
import {
	type AiUsageEvent,
	type AiUsageGenerationRef,
	bundledReservationPendingAttemptRef,
	GatewayUsagePendingError,
	helperStepUsage,
	isBundledUnmeteredStepUsage,
	type MeteringGateway,
	MeteringStateConflictError,
} from "../../domain/metering";
import {
	normalizeTokenUsage,
	type TokenUsageQuote,
	usdMicrosToCentiCredits,
} from "../../domain/model-pricing";
import { maxFinalCreditsCeiling } from "../../domain/operation-registry";
import type {
	AiProviderCallEvidence,
	ProviderCallEvidenceCost,
	ProviderCallEvidenceInput,
} from "../../domain/provider-call-evidence";
import type {
	AiUsageEventPatch,
	InsertAiUsageEvent,
	InsertAiUsageGenerationRef,
	MeteringRepository,
	MeteringTransaction,
} from "../../infrastructure/persistence/metering.repository";
import { MeteringService, RECONCILE_DEAD_LETTER_CAP } from "./metering.service";
import type { ModelPricingService } from "./model-pricing.service";

const USER_ID = "user_1";
const USER_SUBJECT: MeteringSubject = { actorUserId: USER_ID };
const CHAT_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_PENDING_ATTEMPT_REF =
	bundledReservationPendingAttemptRef("project:project-1");

/** Pre-deploy helper rows: no writer emits this tag any more. */
function bundledUnmeteredStepUsage(
	operation: "project_title" | "prompt_refine",
	providerUsage: unknown,
): Record<string, unknown> {
	return {
		metering: { customerBilling: "bundled_unmetered", operation },
		providerUsage,
	};
}

class InMemoryMeteringRepository {
	readonly events = new Map<string, AiUsageEvent>();
	readonly refs = new Map<string, AiUsageGenerationRef>();
	readonly evidence = new Map<string, AiProviderCallEvidence>();
	readonly operationLocks: string[] = [];
	failUpdateEventId: string | null = null;
	private transactionQueue: Promise<void> = Promise.resolve();
	private readonly transactionClient = {} as MeteringTransaction;

	async transaction<T>(
		fn: (transaction: MeteringTransaction) => Promise<T>,
	): Promise<T> {
		const previous = this.transactionQueue;
		let release!: () => void;
		this.transactionQueue = new Promise((resolve) => {
			release = resolve;
		});
		await previous;
		const eventSnapshot = new Map(this.events);
		const refSnapshot = new Map(this.refs);
		const evidenceSnapshot = new Map(this.evidence);

		try {
			return await fn(this.transactionClient);
		} catch (error) {
			this.events.clear();
			for (const [id, event] of eventSnapshot) {
				this.events.set(id, event);
			}
			this.refs.clear();
			for (const [id, ref] of refSnapshot) {
				this.refs.set(id, ref);
			}
			this.evidence.clear();
			for (const [id, row] of evidenceSnapshot) {
				this.evidence.set(id, row);
			}
			throw error;
		} finally {
			release();
		}
	}

	async acquireOperationLock(operationKey: string): Promise<void> {
		this.operationLocks.push(operationKey);
	}

	async findEventById(eventId: string): Promise<AiUsageEvent | null> {
		return this.events.get(eventId) ?? null;
	}

	async findEventByIdempotencyKey(
		idempotencyKey: string,
	): Promise<AiUsageEvent | null> {
		return (
			[...this.events.values()].find(
				(event) => event.idempotencyKey === idempotencyKey,
			) ?? null
		);
	}

	async insertEvent(input: InsertAiUsageEvent): Promise<AiUsageEvent> {
		const existing = await this.findEventByIdempotencyKey(input.idempotencyKey);

		if (existing) {
			return existing;
		}

		const event = makeEvent(input);
		this.events.set(event.id, event);
		return event;
	}

	async updateEvent(
		eventId: string,
		expectedStatuses: readonly AiUsageEvent["status"][],
		patch: AiUsageEventPatch,
	): Promise<AiUsageEvent | null> {
		if (this.failUpdateEventId === eventId) {
			throw new Error(`forced update failure for ${eventId}`);
		}

		const current = this.events.get(eventId);

		if (!current || !expectedStatuses.includes(current.status)) {
			return null;
		}

		const updated = { ...current, ...patch } as AiUsageEvent;
		this.events.set(eventId, updated);
		return updated;
	}

	async transitionEventAttemptRef(
		eventId: string,
		expectedAttemptRef: string,
		nextAttemptRef: string,
		expectedStatuses: readonly AiUsageEvent["status"][],
	): Promise<AiUsageEvent | null> {
		const current = this.events.get(eventId);

		if (
			current?.status === undefined ||
			!expectedStatuses.includes(current.status) ||
			current.attemptRef !== expectedAttemptRef
		) {
			return null;
		}

		const updated = { ...current, attemptRef: nextAttemptRef };
		this.events.set(eventId, updated);
		return updated;
	}

	async listGenerationRefs(eventId: string) {
		return [...this.refs.values()].filter(
			(ref) => ref.usageEventId === eventId,
		);
	}

	async insertGenerationRef(input: InsertAiUsageGenerationRef) {
		const existing = [...this.refs.values()].find(
			(ref) => ref.gatewayGenerationId === input.gatewayGenerationId,
		);

		if (existing) {
			if (existing.usageEventId !== input.usageEventId) {
				throw new Error("generation belongs to another event");
			}

			const requestedStepUsage = input.stepUsage ?? null;

			if (requestedStepUsage !== null && existing.stepUsage === null) {
				const enriched = { ...existing, stepUsage: requestedStepUsage };
				this.refs.set(existing.id, enriched);
				return enriched;
			}

			if (
				requestedStepUsage !== null &&
				JSON.stringify(existing.stepUsage) !==
					JSON.stringify(requestedStepUsage)
			) {
				throw new Error(
					`Gateway generation ${input.gatewayGenerationId} has conflicting step usage`,
				);
			}

			return existing;
		}

		const ref: AiUsageGenerationRef = {
			gatewayGenerationId: input.gatewayGenerationId,
			id: randomUUID(),
			providerSource: input.providerSource ?? "vercel",
			reconciledAt: null,
			reconciledCostUsdMicros: null,
			stepUsage: input.stepUsage ?? null,
			usageEventId: input.usageEventId,
		};
		this.refs.set(ref.id, ref);
		return ref;
	}

	async updateGenerationRefStepUsage(
		generationRefId: string,
		stepUsage: unknown,
	) {
		const ref = this.refs.get(generationRefId);

		if (!ref) {
			throw new Error("missing ref");
		}

		const updated = { ...ref, stepUsage };
		this.refs.set(generationRefId, updated);
		return updated;
	}

	async markGenerationRefReconciled(
		generationRefId: string,
		costUsdMicros: number,
		reconciledAt: Date,
	): Promise<void> {
		const ref = this.refs.get(generationRefId);

		if (!ref) {
			throw new Error("missing ref");
		}

		this.refs.set(generationRefId, {
			...ref,
			reconciledAt,
			reconciledCostUsdMicros: costUsdMicros,
		});
	}

	async listProviderCallEvidence(eventId: string) {
		return [...this.evidence.values()].filter(
			(row) => row.usageEventId === eventId,
		);
	}

	async findProviderCallEvidenceById(evidenceId: string) {
		return this.evidence.get(evidenceId) ?? null;
	}

	async insertProviderCallEvidence(
		input: ProviderCallEvidenceInput & { usageEventId: string },
	) {
		const existing = [...this.evidence.values()].find(
			(row) => row.idempotencyKey === input.idempotencyKey,
		);

		if (existing) {
			if (existing.usageEventId !== input.usageEventId) {
				throw new Error("evidence belongs to another event");
			}

			return existing;
		}

		const row: AiProviderCallEvidence = {
			chargedUsdMicros: input.chargedUsdMicros ?? null,
			costSource: input.costSource ?? null,
			costStatus: input.costStatus,
			createdAt: new Date(),
			customerBillable: input.customerBillable,
			id: randomUUID(),
			idempotencyKey: input.idempotencyKey,
			providerRequestId: input.providerRequestId ?? null,
			rateUsdMicrosPerUnit: input.rateUsdMicrosPerUnit ?? null,
			rawReceipt: input.rawReceipt ?? null,
			transport: input.transport,
			unitKind: input.unitKind,
			units: input.units,
			updatedAt: new Date(),
			usageEventId: input.usageEventId,
		};
		this.evidence.set(row.id, row);
		return row;
	}

	async updateProviderCallEvidenceCost(
		evidenceId: string,
		cost: ProviderCallEvidenceCost & { units: number },
	) {
		const row = this.evidence.get(evidenceId);

		if (!row) {
			throw new Error("missing evidence");
		}

		const updated: AiProviderCallEvidence = {
			...row,
			chargedUsdMicros: cost.chargedUsdMicros,
			costSource: cost.costSource ?? null,
			costStatus: cost.costStatus,
			rateUsdMicrosPerUnit: cost.rateUsdMicrosPerUnit ?? null,
			...(cost.rawReceipt === undefined ? {} : { rawReceipt: cost.rawReceipt }),
			units: cost.units,
			updatedAt: new Date(),
		};
		this.evidence.set(evidenceId, updated);
		return updated;
	}

	async listStaleReserved(createdBefore: Date, limit: number) {
		return [...this.events.values()]
			.filter(
				(event) =>
					event.status === "reserved" && event.createdAt < createdBefore,
			)
			.slice(0, limit);
	}

	async listUnreconciledSettled(createdBefore: Date, limit: number) {
		return [...this.events.values()]
			.filter(
				(event) =>
					event.status === "settled" &&
					event.createdAt < createdBefore &&
					[...this.refs.values()].some(
						(ref) => ref.usageEventId === event.id && ref.reconciledAt === null,
					),
			)
			.slice(0, limit);
	}

	async listRetryableReconcileFailed(now: Date, limit: number) {
		return [...this.events.values()]
			.filter(
				(event) =>
					event.status === "reconcile_failed" &&
					event.nextReconcileAttemptAt !== null &&
					event.nextReconcileAttemptAt <= now,
			)
			.slice(0, limit);
	}

	async listSettledWithoutRefs(createdBefore: Date, limit: number) {
		return [...this.events.values()]
			.filter(
				(event) =>
					event.status === "settled" &&
					event.createdAt < createdBefore &&
					![...this.refs.values()].some((ref) => ref.usageEventId === event.id),
			)
			.slice(0, limit);
	}
}

type ConsumeCall = {
	allowOverdraft: boolean;
	amount: number;
	idempotencyKey: string;
	planHold: "active" | "inactive" | null;
	transaction: unknown;
	userId: string;
};

type RefundCall = {
	amount: number;
	consumeIdempotencyKey: string;
	idempotencyKey: string;
	transaction: unknown;
	userId: string;
};

class InMemoryCreditsService {
	readonly balances = new Map<string, number>();
	readonly consumeCalls: ConsumeCall[] = [];
	readonly netConsumed = new Map<string, number>();
	readonly netConsumedCalls: Array<{ transaction: unknown; userId: string }> =
		[];
	readonly refundCalls: RefundCall[] = [];
	readonly planHolds = new Map<string, "active" | "closed" | "inactive">();
	private readonly consumes = new Map<
		string,
		{ allowOverdraft: boolean; amount: number; userId: string }
	>();
	private readonly refunds = new Map<
		string,
		{ amount: number; consumeIdempotencyKey: string; userId: string }
	>();

	setBalance(userId: string, balance: number): void {
		this.balances.set(userId, balance);
	}

	setNetConsumed(userId: string, amount: number): void {
		this.netConsumed.set(userId, amount);
	}

	async netConsumedCentiCredits(
		userId: string,
		transaction?: unknown,
	): Promise<number> {
		this.netConsumedCalls.push({ transaction, userId });

		return this.netConsumed.get(userId) ?? 0;
	}

	async consume(
		owner: CreditOwner,
		amount: number,
		options: {
			actorUserId?: string;
			admission?: "requirePositiveBalance";
			allowOverdraft?: boolean;
			idempotencyKey?: string;
			planHold?: "active" | "inactive";
		},
		transaction?: unknown,
	): Promise<[]> {
		const userId = ownerBalanceKey(owner);
		const idempotencyKey = options.idempotencyKey ?? "";
		const allowOverdraft = options.allowOverdraft === true;
		const requirePositiveBalance =
			options.admission === "requirePositiveBalance";
		const existing = this.consumes.get(idempotencyKey);

		if (existing) {
			if (
				existing.amount !== amount ||
				existing.userId !== userId ||
				existing.allowOverdraft !== allowOverdraft
			) {
				throw new Error("consume replay conflict");
			}
			return [];
		}

		const balance = this.balances.get(userId) ?? 0;

		// Mirrors CreditsService: ruling-5 admission admits any positive balance
		// into overdraft; the legacy path needs the full amount.
		if (
			requirePositiveBalance
				? balance <= 0
				: !allowOverdraft && balance < amount
		) {
			throw new InsufficientCreditsError(amount, balance);
		}

		this.consumes.set(idempotencyKey, {
			allowOverdraft,
			amount,
			userId,
		});
		this.consumeCalls.push({
			allowOverdraft,
			amount,
			idempotencyKey,
			planHold: options.planHold ?? null,
			transaction,
			userId,
		});
		if (options.planHold) {
			this.planHolds.set(idempotencyKey, options.planHold);
		}
		this.balances.set(userId, balance - amount);
		this.netConsumed.set(userId, (this.netConsumed.get(userId) ?? 0) + amount);
		return [];
	}

	async refundConsumeAmount(
		owner: CreditOwner,
		consumeIdempotencyKey: string,
		options: { amount: number; idempotencyKey: string },
		transaction?: unknown,
	): Promise<[]> {
		const userId = ownerBalanceKey(owner);
		const existing = this.refunds.get(options.idempotencyKey);

		if (existing) {
			if (
				existing.amount !== options.amount ||
				existing.userId !== userId ||
				existing.consumeIdempotencyKey !== consumeIdempotencyKey
			) {
				throw new Error("refund replay conflict");
			}
			return [];
		}

		this.refunds.set(options.idempotencyKey, {
			amount: options.amount,
			consumeIdempotencyKey,
			userId,
		});
		this.refundCalls.push({
			amount: options.amount,
			consumeIdempotencyKey,
			idempotencyKey: options.idempotencyKey,
			transaction,
			userId,
		});
		this.balances.set(
			userId,
			(this.balances.get(userId) ?? 0) + options.amount,
		);
		this.netConsumed.set(
			userId,
			(this.netConsumed.get(userId) ?? 0) - options.amount,
		);
		return [];
	}

	async markPlanHoldInactive(
		_owner: CreditOwner,
		consumeIdempotencyKey: string,
	): Promise<void> {
		if (this.planHolds.has(consumeIdempotencyKey)) {
			this.planHolds.set(consumeIdempotencyKey, "inactive");
		}
	}

	async closePlanHold(
		_owner: CreditOwner,
		consumeIdempotencyKey: string,
	): Promise<void> {
		if (this.planHolds.has(consumeIdempotencyKey)) {
			this.planHolds.set(consumeIdempotencyKey, "closed");
		}
	}
}

function ownerBalanceKey(owner: CreditOwner): string {
	return owner.type === "user" ? owner.userId : owner.organizationId;
}

class FakeModelPricingService {
	usdMicrosPerCredit = 50_000;
	quoteCalls = 0;
	quote: TokenUsageQuote = {
		costUsdMicros: 75_000,
		credits: 150,
		pricingSnapshot: {
			cacheReadUsdMicrosPerMTok: 100,
			cacheWriteUsdMicrosPerMTok: 100,
			imageUsdMicros: null,
			inputUsdMicrosPerMTok: 100,
			modelId: "openai/test",
			modelType: "language",
			outputUsdMicrosPerMTok: 200,
			provider: "openai",
			refreshedAt: "2026-08-01T00:00:00.000Z",
			source: "database",
			transcriptionUsdMicrosPerSecond: null,
			usdMicrosPerCredit: 50_000,
			videoUsdMicrosPerSecond: null,
		},
		usage: {
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			inputTokens: 0,
			outputTokens: 0,
			uncachedInputTokens: 0,
		},
	};

	async quoteTokenUsage(
		_modelId: string,
		usage: Parameters<typeof normalizeTokenUsage>[0],
		usdMicrosPerCredit = this.usdMicrosPerCredit,
	): Promise<TokenUsageQuote> {
		this.quoteCalls += 1;
		return {
			...this.quote,
			credits: usdMicrosToCentiCredits(
				this.quote.costUsdMicros,
				usdMicrosPerCredit,
			),
			pricingSnapshot: {
				...this.quote.pricingSnapshot,
				usdMicrosPerCredit,
			},
			usage: normalizeTokenUsage(usage),
		};
	}
}

class FakeMeteringGateway implements MeteringGateway {
	readonly calls: { id: string; source: string }[] = [];
	readonly results = new Map<
		string,
		Awaited<ReturnType<MeteringGateway["getGenerationInfo"]>> | Error
	>();

	async getGenerationInfo({ id, source }: { id: string; source: string }) {
		this.calls.push({ id, source });
		const result = this.results.get(id);

		if (!result) {
			throw new Error(`No fake gateway result for ${id}`);
		}

		if (result instanceof Error) {
			throw result;
		}

		return result;
	}
}

/** Reservation snapshot written before measured billing (fixed mode). */
function legacyFixedReservationSnapshot(
	operation: "image" | "video",
	creditsPerUnit: number,
) {
	return {
		creditsPerUnit,
		mode: "fixed",
		operation,
		reserveFloorCredits: creditsPerUnit,
		source: "operation_registry_reservation",
		unit: operation === "image" ? "image" : "operation",
		usdMicrosPerCredit: 50_000,
	};
}

/** Reservation snapshot written before measured billing (per-minute mode). */
function legacyPerMinuteReservationSnapshot(creditsPerMinute: number) {
	return {
		creditsPerMinute,
		maxDurationSeconds: 300,
		minimumCredits: creditsPerMinute,
		mode: "per_minute",
		operation: "transcription",
		reserveFloorCredits: creditsPerMinute,
		source: "operation_registry_reservation",
		unit: "minute",
		usdMicrosPerCredit: 50_000,
	};
}

function measuredSettlement(
	operation: "image" | "video",
	units: number,
	estimatedUnitUsdMicros: number | null,
	options: { outcome?: string } = {},
) {
	const costUsdMicros =
		estimatedUnitUsdMicros === null ? null : estimatedUnitUsdMicros * units;

	return {
		costUsdMicros,
		finalCredits:
			units === 0 || costUsdMicros === null
				? 0
				: usdMicrosToCentiCredits(costUsdMicros, 50_000),
		pricing: "direct" as const,
		pricingSnapshot: {
			estimatedUnitUsdMicros,
			mode: "measured",
			operation,
			outcome:
				options.outcome ??
				(units === 0 ? "failed_no_deliverable" : "delivered"),
			source: "measured_local",
			unit: operation === "image" ? "image" : "video",
			units,
			usdMicrosPerCredit: 50_000,
		},
	};
}

function setup(balance = 10_000, signupGrantCentiCredits = 700) {
	const repository = new InMemoryMeteringRepository();
	const credits = new InMemoryCreditsService();
	const pricing = new FakeModelPricingService();
	const gateway = new FakeMeteringGateway();
	const organizationLimits = {
		resolveMemberLimit: vi.fn(async () => ({
			limitCredits: null,
			source: "none",
		})),
		sumMemberSpendThisMonth: vi.fn(async () => 0),
	} as unknown as OrganizationLimitsRepository;
	const lifecycleRows = new Map<string, EnqueueLifecycleEvent>();
	const lifecycleEnqueue = vi.fn(
		async (
			input: EnqueueLifecycleEvent,
			_transaction?: LifecycleEventsTransaction,
		): Promise<LifecycleEventRow | null> => {
			if (lifecycleRows.has(input.idempotencyKey)) {
				return null;
			}

			lifecycleRows.set(input.idempotencyKey, input);

			return { id: input.idempotencyKey } as LifecycleEventRow;
		},
	);
	const lifecycle = new LifecycleEventsService({
		enqueue: lifecycleEnqueue,
		resolveSignupGrantCentiCredits: vi.fn(async () => signupGrantCentiCredits),
	} as unknown as LifecycleEventsRepository);
	credits.setBalance(USER_ID, balance);
	const service = new MeteringService(
		repository as unknown as MeteringRepository,
		credits as unknown as CreditsService,
		pricing as unknown as ModelPricingService,
		gateway,
		organizationLimits,
		lifecycle,
	);

	return {
		credits,
		gateway,
		lifecycleEnqueue,
		lifecycleRows,
		organizationLimits,
		pricing,
		repository,
		service,
	};
}

describe("MeteringService", () => {
	it("trusts only the exact internal project-title unmetered marker", () => {
		expect(
			isBundledUnmeteredStepUsage(
				bundledUnmeteredStepUsage("project_title", { inputTokens: 1 }),
			),
		).toBe(true);
		expect(
			isBundledUnmeteredStepUsage({
				metering: { customerBilling: "bundled_unmetered" },
			}),
		).toBe(false);
		expect(
			isBundledUnmeteredStepUsage({
				metering: {
					customerBilling: "bundled_unmetered",
					operation: "provider_supplied",
				},
			}),
		).toBe(false);
	});

	it("atomically refuses a reserve with the typed 402 and leaves no event", async () => {
		// Ruling 5: a zero (or negative) balance refuses every new reserve.
		const { credits, repository, service } = setup(0);

		await expect(
			service.reserve("chat", USER_SUBJECT, {
				credits: 300,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:message_1",
			}),
		).rejects.toMatchObject({
			// The error exposes decimal display credits (0 cc / 300 cc inputs).
			availableCredits: 0,
			requiredCredits: 3,
			status: 402,
		});
		expect(repository.events).toHaveLength(0);
		expect(credits.balances.get(USER_ID)).toBe(0);
	});

	it("admits a reserve above a small positive balance into overdraft", async () => {
		const { credits, service } = setup(1);

		const event = await service.reserve("chat", USER_SUBJECT, {
			credits: 300,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_overdraft",
		});

		expect(event.status).toBe("reserved");
		expect(credits.consumeCalls[0]).toMatchObject({ amount: 300 });
		expect(credits.balances.get(USER_ID)).toBe(-299);
	});

	it("serializes concurrent reserves so only the affordable operation wins", async () => {
		const { credits, repository, service } = setup(100);
		const results = await Promise.allSettled([
			service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:one",
			}),
			service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId: "22222222-2222-4222-8222-222222222222",
				idempotencyKey: "chat:two",
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(repository.events).toHaveLength(1);
		expect(credits.balances.get(USER_ID)).toBe(0);
	});

	it("replays reserve without a second debit and rejects a changed fingerprint", async () => {
		const { credits, service } = setup();
		const estimate = {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		};
		const first = await service.reserveWithReplay(
			"chat",
			USER_SUBJECT,
			estimate,
		);
		const replay = await service.reserveWithReplay(
			"chat",
			USER_SUBJECT,
			estimate,
		);

		expect(first).toMatchObject({ replay: "none", replayed: false });
		expect(replay).toEqual({
			event: first.event,
			replay: "reserved",
			replayed: true,
		});
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.consumeCalls[0]).toMatchObject({
			allowOverdraft: false,
			amount: 200,
			idempotencyKey: `reserve:${CHAT_EVENT_ID}`,
		});
		await expect(
			service.reserve("chat", USER_SUBJECT, { ...estimate, credits: 300 }),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
	});

	it("replays an org reserve for a different acting member of the same pool", async () => {
		const { credits, service } = setup();
		credits.setBalance("org_1", 10_000);
		const estimate = {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:org_message_1",
		};

		// Member A (the project creator) reserved at the tool boundary; member
		// B's task delivery replays the same key. Same pool -> legal replay.
		const first = await service.reserveWithReplay(
			"chat",
			{ actorUserId: USER_ID, organizationId: "org_1" },
			estimate,
		);
		const replay = await service.reserveWithReplay(
			"chat",
			{ actorUserId: "user_member_2", organizationId: "org_1" },
			estimate,
		);

		expect(replay).toEqual({
			event: first.event,
			replay: "reserved",
			replayed: true,
		});
		// Provenance keeps the original reserver; no second debit happened.
		expect(replay.event.userId).toBe(USER_ID);
		expect(credits.consumeCalls).toHaveLength(1);

		// A different PERSONAL user replaying the key is a cross-payer conflict.
		await expect(
			service.reserveWithReplay(
				"chat",
				{ actorUserId: "user_member_2" },
				estimate,
			),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
	});

	it("atomically admits only one bundled-reservation claim across concurrent instances", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		const claim = (requestId: string) =>
			service.claimBundledReservation({
				chatId: "chat-1",
				claimAttemptRef: bundledReservationPendingAttemptRef(
					`project-stream:project-1:${requestId}`,
				),
				expectedAttemptRef: PROJECT_PENDING_ATTEMPT_REF,
				idempotencyKey: "project-create:project-1",
				messageId: "message-1",
				operation: "chat",
				subject: USER_SUBJECT,
			});

		const results = await Promise.allSettled([
			claim("request-1"),
			claim("request-2"),
		]);
		const fulfilled = results.filter((result) => result.status === "fulfilled");

		// Exactly one request wins the bundle; the loser resolves null and takes
		// a NORMAL hold instead (conflicting here used to brick the loser's turn
		// behind a 409 whenever the winner's stream later crashed).
		expect(fulfilled).toHaveLength(2);
		const values = fulfilled.map(
			(result) => (result as PromiseFulfilledResult<unknown>).value,
		);
		expect(values.filter((value) => value === null)).toHaveLength(1);
		expect(values.filter((value) => value !== null)).toHaveLength(1);
		expect(repository.events.get(CHAT_EVENT_ID)?.attemptRef).toMatch(
			/^bundled-pending:project-stream:project-1:request-[12]$/,
		);
		expect(credits.consumeCalls).toHaveLength(1);
		expect(repository.operationLocks).toContain(
			"metering-reserve:project-create:project-1",
		);
		expect(repository.operationLocks).toContain(
			`metering-event:${CHAT_EVENT_ID}`,
		);
	});

	it("hands a crashed claim back to the identical retry and releases refunded ones", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		const input = {
			chatId: "chat-1",
			claimAttemptRef: bundledReservationPendingAttemptRef(
				"project-stream:project-1:request-1",
			),
			expectedAttemptRef: PROJECT_PENDING_ATTEMPT_REF,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
			operation: "chat" as const,
			subject: USER_SUBJECT,
		};

		await service.claimBundledReservation(input);

		// The claimed stream died before settling (hold still reserved): the
		// identical retry ADOPTS the claim instead of replay-conflicting — this
		// was the turn-1 variant of the bricked-chat 409.
		await expect(service.claimBundledReservation(input)).resolves.toMatchObject(
			{
				attemptRef: input.claimAttemptRef,
				id: CHAT_EVENT_ID,
			},
		);

		// A NEW turn while the bundle is stuck under the crashed claim takes a
		// normal hold instead of bricking the chat.
		await expect(
			service.claimBundledReservation({
				...input,
				claimAttemptRef: bundledReservationPendingAttemptRef(
					"project-stream:project-1:request-2",
				),
				messageId: "message-2",
			}),
		).resolves.toBeNull();

		// Once stranded recovery refunds the crashed claim, the identical retry
		// falls through to a normal hold — never a permanent 409.
		const claimed = repository.events.get(CHAT_EVENT_ID);

		if (!claimed) {
			throw new Error("missing claimed event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...claimed,
			finalCredits: 0,
			settledAt: new Date(),
			status: "refunded",
		});
		await expect(service.claimBundledReservation(input)).resolves.toBeNull();
	});

	it("preserves title-complete state when completion wins before the stream claim", async () => {
		const { service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		await service.completeBundledReservation(CHAT_EVENT_ID);

		await expect(
			service.claimBundledReservation({
				chatId: "chat-1",
				claimAttemptRef: bundledReservationPendingAttemptRef(
					"project-stream:project-1:request-1",
				),
				expectedAttemptRef: PROJECT_PENDING_ATTEMPT_REF,
				idempotencyKey: "project-create:project-1",
				messageId: "message-1",
				operation: "chat",
				subject: USER_SUBJECT,
			}),
		).resolves.toMatchObject({
			attemptRef: "bundled-complete:project-stream:project-1:request-1",
		});
	});

	it("keeps the bundled claim durable after settlement and only releases new messages", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		const input = {
			chatId: "chat-1",
			claimAttemptRef: bundledReservationPendingAttemptRef(
				"project-stream:project-1:request-1",
			),
			expectedAttemptRef: PROJECT_PENDING_ATTEMPT_REF,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
			operation: "chat" as const,
			subject: USER_SUBJECT,
		};

		await expect(service.claimBundledReservation(input)).resolves.toMatchObject(
			{
				attemptRef: input.claimAttemptRef,
				id: CHAT_EVENT_ID,
			},
		);
		const claimed = repository.events.get(CHAT_EVENT_ID);

		if (!claimed) {
			throw new Error("missing claimed event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...claimed,
			finalCredits: 100,
			settledAt: new Date(),
			status: "settled",
		});

		await expect(service.claimBundledReservation(input)).rejects.toBeInstanceOf(
			MeteringStateConflictError,
		);
		// A DIFFERENT attempt after settlement is a new turn, not a replay —
		// even with the same final user message: ask_user resumes re-stream
		// without adding a user message. It falls through to a normal hold.
		await expect(
			service.claimBundledReservation({
				...input,
				claimAttemptRef: bundledReservationPendingAttemptRef(
					"project-stream:project-1:request-2",
				),
			}),
		).resolves.toBeNull();
		await expect(
			service.claimBundledReservation({
				...input,
				claimAttemptRef: bundledReservationPendingAttemptRef(
					"project-stream:project-1:request-2",
				),
				messageId: "message-2",
			}),
		).resolves.toBeNull();
	});

	it("holds reconciliation until bundled title capture is complete", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		await service.claimBundledReservation({
			chatId: "chat-1",
			claimAttemptRef: bundledReservationPendingAttemptRef(
				"project-stream:project-1:request-1",
			),
			expectedAttemptRef: PROJECT_PENDING_ATTEMPT_REF,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
			operation: "chat",
			subject: USER_SUBJECT,
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "title-generation" } },
			stepUsage: bundledUnmeteredStepUsage("project_title", {
				inputTokens: 10,
				outputTokens: 2,
			}),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "chat-generation" } },
			stepUsage: { inputTokens: 10, outputTokens: 2 },
		});
		await service.settle(CHAT_EVENT_ID, {
			modelId: "openai/test",
			pricing: "token",
			usage: { inputTokens: 10, outputTokens: 2 },
		});
		gateway.results.set(
			"title-generation",
			generationInfo("title-generation", 0.5),
		);
		gateway.results.set(
			"chat-generation",
			generationInfo("chat-generation", 0.05),
		);

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toBeInstanceOf(
			GatewayUsagePendingError,
		);

		const completed = await service.completeBundledReservation(CHAT_EVENT_ID);

		expect(completed.attemptRef).toBe(
			"bundled-complete:project-stream:project-1:request-1",
		);
		await expect(service.reconcile(CHAT_EVENT_ID)).resolves.toMatchObject({
			event: {
				finalCredits: 100,
				pricingSnapshot: {
					gatewayReconciliation: {
						customerBillableCostUsdMicros: 50_000,
						generations: expect.arrayContaining([
							expect.objectContaining({
								costUsdMicros: 500_000,
								customerBilling: "bundled_unmetered_legacy",
								id: "title-generation",
							}),
							expect.objectContaining({
								costUsdMicros: 50_000,
								customerBilling: "metered",
								id: "chat-generation",
							}),
						]),
					},
				},
				reconciledCostUsdMicros: 550_000,
				status: "reconciled",
			},
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
	});

	it("keeps the minimum one-centi-credit creation charge when only bundled title usage exists", async () => {
		const { credits, gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "project-create:project-1",
			messageId: "message-1",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "title-generation" } },
			stepUsage: bundledUnmeteredStepUsage("project_title", {
				inputTokens: 20,
				outputTokens: 4,
			}),
		});
		const completed = await service.completeBundledReservation(CHAT_EVENT_ID);
		repository.events.set(CHAT_EVENT_ID, {
			...completed,
			createdAt: new Date("2026-07-31T00:00:00.000Z"),
		});
		gateway.results.set(
			"title-generation",
			generationInfo("title-generation", 0.5),
		);

		await expect(
			service.recoverStaleReservations(new Date("2026-08-01T00:00:00.000Z")),
		).resolves.toMatchObject({ reconciled: 1, refunded: 0 });
		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			finalCredits: 1,
			reconciledCostUsdMicros: 500_000,
			status: "reconciled",
		});
		expect(credits.balances.get(USER_ID)).toBe(9_999);
	});

	it.each([
		"settled",
		"reconciled",
	] as const)("reports an explicit %s replay while the provider-facing reserve fails closed", async (status) => {
		const { credits, repository, service } = setup();
		const estimate = {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:terminal-replay",
		};
		const first = await service.reserveWithReplay(
			"chat",
			USER_SUBJECT,
			estimate,
		);
		repository.events.set(CHAT_EVENT_ID, {
			...first.event,
			status,
		});

		await expect(
			service.reserveWithReplay("chat", USER_SUBJECT, estimate),
		).resolves.toMatchObject({ replay: status, replayed: true });
		await expect(
			service.reserve("chat", USER_SUBJECT, estimate),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
		expect(credits.consumeCalls).toHaveLength(1);
	});

	it.each([
		"refunded",
		"reconcile_failed",
	] as const)("fails closed when a reservation key replays a %s event", async (status) => {
		const { credits, repository, service } = setup();
		const estimate = {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:failed-replay",
		};
		const first = await service.reserveWithReplay(
			"chat",
			USER_SUBJECT,
			estimate,
		);
		repository.events.set(CHAT_EVENT_ID, {
			...first.event,
			status,
		});

		await expect(
			service.reserveWithReplay("chat", USER_SUBJECT, estimate),
		).rejects.toMatchObject({ status });
		expect(credits.consumeCalls).toHaveLength(1);
	});

	it("enforces reserve floors and same-user parent-child registry rules", async () => {
		const { service } = setup();

		await expect(
			service.reserve("image", USER_SUBJECT, {
				credits: 99,
				idempotencyKey: "image:too-cheap",
			}),
		).rejects.toThrow("at least 100 centi-credits");

		const parent = await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:parent",
		});
		await expect(
			service.reserve("image", USER_SUBJECT, {
				credits: 350,
				idempotencyKey: "image:child",
				parentEventId: parent.id,
			}),
		).resolves.toMatchObject({ operation: "image", parentEventId: parent.id });
		await expect(
			service.reserve("transcription", USER_SUBJECT, {
				credits: 100,
				idempotencyKey: "transcription:child",
				parentEventId: parent.id,
			}),
		).rejects.toThrow("cannot be nested under chat");
	});

	it("settles an overage to debt once with settle:{eventId}", async () => {
		const { credits, service } = setup(1000);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1000,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		const settlement = {
			finalCredits: 1300,
			pricing: "direct" as const,
			pricingSnapshot: { mode: "fixed" },
		};
		const settled = await service.settle(CHAT_EVENT_ID, settlement);
		const replay = await service.settle(CHAT_EVENT_ID, settlement);

		expect(settled.status).toBe("settled");
		expect(replay).toEqual(settled);
		expect(credits.consumeCalls).toHaveLength(2);
		expect(credits.consumeCalls[1]).toMatchObject({
			allowOverdraft: true,
			amount: 300,
			idempotencyKey: `settle:${CHAT_EVENT_ID}`,
		});
		expect(credits.balances.get(USER_ID)).toBe(-300);
	});

	it("enqueues the first credit milestone at a personal 349 to 350 centi-credit crossing and not on replay", async () => {
		const { credits, lifecycleEnqueue, lifecycleRows, service } = setup();
		credits.setNetConsumed(USER_ID, 339);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:threshold-25",
		});
		const settlement = {
			finalCredits: 11,
			pricing: "direct" as const,
			pricingSnapshot: { mode: "fixed" },
		};

		await service.settle(CHAT_EVENT_ID, settlement);

		expect(lifecycleRows.get(`credits_25_used:${USER_ID}`)).toEqual({
			event: "credits_25_used",
			idempotencyKey: `credits_25_used:${USER_ID}`,
			userId: USER_ID,
		});
		expect(credits.netConsumedCalls).toEqual([
			{ transaction: expect.anything(), userId: USER_ID },
		]);
		expect(lifecycleEnqueue).toHaveBeenCalledTimes(1);

		await service.settle(CHAT_EVENT_ID, settlement);

		expect(credits.netConsumedCalls).toHaveLength(1);
		expect(lifecycleEnqueue).toHaveBeenCalledTimes(1);
	});

	it("enqueues the second credit milestone at 560 centi-credits with a 15-minute hold", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-24T12:00:00.000Z"));

		try {
			const { credits, lifecycleRows, service } = setup();
			credits.setNetConsumed(USER_ID, 550);
			await service.reserve("chat", USER_SUBJECT, {
				credits: 10,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:threshold-40",
			});

			await service.settle(CHAT_EVENT_ID, {
				finalCredits: 10,
				pricing: "direct",
				pricingSnapshot: { mode: "fixed" },
			});

			expect(lifecycleRows.get(`credits_40_used:${USER_ID}`)).toEqual({
				dispatchAfter: new Date("2026-08-24T12:15:00.000Z"),
				event: "credits_40_used",
				idempotencyKey: `credits_40_used:${USER_ID}`,
				userId: USER_ID,
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses a legacy recipient's 5000 cc signup grant for metering milestones", async () => {
		const { credits, lifecycleEnqueue, lifecycleRows, service } = setup(
			10_000,
			5000,
		);
		credits.setNetConsumed(USER_ID, 2490);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:legacy-grant-threshold",
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 10,
			pricing: "direct",
			pricingSnapshot: { mode: "fixed" },
		});

		expect(lifecycleRows.get(`credits_25_used:${USER_ID}`)).toEqual({
			event: "credits_25_used",
			idempotencyKey: `credits_25_used:${USER_ID}`,
			userId: USER_ID,
		});
		expect(lifecycleRows.has(`credits_40_used:${USER_ID}`)).toBe(false);
		expect(lifecycleEnqueue).toHaveBeenCalledOnce();
	});

	it("enqueues the first credit milestone when a partial settlement refund leaves net use above the threshold", async () => {
		const { credits, lifecycleEnqueue, lifecycleRows, service } = setup();
		credits.setNetConsumed(USER_ID, 340);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:threshold-partial-refund",
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 60,
			pricing: "direct",
			pricingSnapshot: { mode: "fixed" },
		});

		expect(credits.netConsumed.get(USER_ID)).toBe(400);
		expect(lifecycleRows.get(`credits_25_used:${USER_ID}`)).toEqual({
			event: "credits_25_used",
			idempotencyKey: `credits_25_used:${USER_ID}`,
			userId: USER_ID,
		});
		expect(credits.netConsumedCalls).toEqual([
			{ transaction: expect.anything(), userId: USER_ID },
		]);
		expect(lifecycleEnqueue).toHaveBeenCalledTimes(1);
	});

	it("evaluates but does not enqueue a threshold when final settlement refunds below it", async () => {
		const { credits, lifecycleEnqueue, service } = setup();
		credits.setNetConsumed(USER_ID, 349);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:threshold-refund",
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 0,
			pricing: "direct",
			pricingSnapshot: { mode: "fixed" },
		});

		expect(credits.netConsumed.get(USER_ID)).toBe(349);
		expect(credits.netConsumedCalls).toEqual([
			{ transaction: expect.anything(), userId: USER_ID },
		]);
		expect(lifecycleEnqueue).not.toHaveBeenCalled();
	});

	it("ignores organization-paid settlements for personal thresholds", async () => {
		const { credits, lifecycleEnqueue, service } = setup();
		credits.setBalance("org_1", 10_000);
		await service.reserve(
			"chat",
			{ actorUserId: USER_ID, organizationId: "org_1" },
			{
				credits: 350,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:org-threshold",
			},
		);

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 350,
			pricing: "direct",
			pricingSnapshot: { mode: "fixed" },
		});

		expect(credits.netConsumedCalls).toHaveLength(0);
		expect(lifecycleEnqueue).not.toHaveBeenCalled();
	});

	it("partially refunds a reserve once with settle-refund:{eventId}", async () => {
		const { credits, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1000,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		const settlement = {
			finalCredits: 600,
			pricing: "direct" as const,
			pricingSnapshot: { mode: "fixed" },
		};
		await service.settle(CHAT_EVENT_ID, settlement);
		await service.settle(CHAT_EVENT_ID, settlement);

		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 400,
				consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(9_400);
	});

	it("never refunds a reserved event after a generation ref is durable", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:captured",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_captured" } },
		});

		await expect(
			service.refund(CHAT_EVENT_ID, "provider_result_not_published"),
		).resolves.toMatchObject({ id: CHAT_EVENT_ID, status: "reserved" });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		expect(credits.refundCalls).toHaveLength(0);
		expect(credits.balances.get(USER_ID)).toBe(9_650);
	});

	it("settles a direct parent and child atomically in parent-first lock order", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("connector", USER_SUBJECT, {
			credits: 500,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "connector:attempt_1",
		});
		await service.reserve("image", USER_SUBJECT, {
			credits: 300,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "image:attempt_1",
			parentEventId: CHAT_EVENT_ID,
		});
		const parent = {
			eventId: CHAT_EVENT_ID,
			settlement: {
				finalCredits: 500,
				pricing: "direct" as const,
				pricingSnapshot: { mode: "fixed", operation: "connector" },
			},
		};
		const child = {
			eventId: CHILD_EVENT_ID,
			settlement: {
				finalCredits: 300,
				pricing: "direct" as const,
				pricingSnapshot: { mode: "fixed", operation: "image" },
			},
		};

		repository.operationLocks.length = 0;
		repository.failUpdateEventId = CHILD_EVENT_ID;
		await expect(service.settleDirectPair(parent, child)).rejects.toThrow(
			"forced update failure",
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		expect(repository.events.get(CHILD_EVENT_ID)?.status).toBe("reserved");
		expect(repository.operationLocks).toEqual([
			`metering-event:${CHAT_EVENT_ID}`,
			`metering-event:${CHILD_EVENT_ID}`,
		]);

		repository.operationLocks.length = 0;
		repository.failUpdateEventId = null;
		await expect(
			service.settleDirectPair(parent, child),
		).resolves.toMatchObject({
			child: { id: CHILD_EVENT_ID, status: "settled" },
			parent: { id: CHAT_EVENT_ID, status: "settled" },
		});
		expect(repository.operationLocks).toEqual([
			`metering-event:${CHAT_EVENT_ID}`,
			`metering-event:${CHILD_EVENT_ID}`,
		]);
		expect(credits.consumeCalls).toHaveLength(2);
	});

	it("atomically upgrades child completion evidence with its ref-less parent settlement", async () => {
		const { repository, service } = setup();
		await service.reserve("connector", USER_SUBJECT, {
			credits: 500,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "connector:completion-atomic",
		});
		await service.reserve("image", USER_SUBJECT, {
			credits: 300,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "image:completion-atomic",
			parentEventId: CHAT_EVENT_ID,
		});
		await service.captureGeneration(CHILD_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_completion_atomic" } },
			stepUsage: {
				metering: { fixedUnits: 0 },
				providerUsage: null,
			},
		});
		const parent = {
			eventId: CHAT_EVENT_ID,
			settlement: {
				finalCredits: 500,
				pricing: "direct" as const,
				pricingSnapshot: {
					creditsPerUnit: 500,
					mode: "fixed",
					operation: "connector",
					units: 1,
				},
			},
		};
		const child = {
			eventId: CHILD_EVENT_ID,
			settlement: {
				finalCredits: 300,
				pricing: "direct" as const,
				pricingSnapshot: {
					creditsPerUnit: 300,
					mode: "fixed",
					operation: "image",
					units: 1,
				},
			},
		};

		repository.failUpdateEventId = CHILD_EVENT_ID;
		await expect(
			service.settleDirectPairWithFixedEvidence(parent, child, {
				completedUnits: 1,
				eventId: CHILD_EVENT_ID,
			}),
		).rejects.toThrow("forced update failure");
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		expect(repository.events.get(CHILD_EVENT_ID)?.status).toBe("reserved");
		expect([...repository.refs.values()][0]?.stepUsage).toMatchObject({
			metering: { fixedUnits: 0 },
		});

		repository.failUpdateEventId = null;
		await expect(
			service.settleDirectPairWithFixedEvidence(parent, child, {
				completedUnits: 1,
				eventId: CHILD_EVENT_ID,
			}),
		).resolves.toMatchObject({
			child: { finalCredits: 300, status: "settled" },
			parent: { finalCredits: 500, status: "settled" },
		});
		expect([...repository.refs.values()][0]?.stepUsage).toMatchObject({
			metering: { fixedUnits: 1 },
		});
	});

	it("persists normalized token details from ModelPricingService", async () => {
		const { service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		const settled = await service.settle(CHAT_EVENT_ID, {
			modelId: "openai/test",
			pricing: "token",
			usage: {
				inputTokenDetails: { cacheReadTokens: 20 },
				inputTokens: 100,
				outputTokens: 30,
			},
		});

		expect(settled).toMatchObject({
			cacheReadTokens: 20,
			cacheWriteTokens: 0,
			finalCredits: 150,
			inputTokens: 100,
			model: "openai/test",
			outputTokens: 30,
			provider: "openai",
			status: "settled",
		});
	});

	it("settles token usage with the durable reservation conversion rate", async () => {
		const { pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:settlement-rate-drift",
		});
		pricing.usdMicrosPerCredit = 100_000;

		const settled = await service.settle(CHAT_EVENT_ID, {
			modelId: "openai/test",
			pricing: "token",
			usage: { inputTokens: 100, outputTokens: 30 },
		});

		expect(settled).toMatchObject({
			finalCredits: 150,
			pricingSnapshot: { usdMicrosPerCredit: 50_000 },
			status: "settled",
		});
	});

	it("settles an event reserved at the 28,000 anchor at 28,000 after the flip to 40,000", async () => {
		const { pricing, service } = setup();
		pricing.usdMicrosPerCredit = 28_000;
		await service.reserve("chat", USER_SUBJECT, {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:anchor-migration",
		});
		pricing.usdMicrosPerCredit = 40_000;

		const settled = await service.settle(CHAT_EVENT_ID, {
			modelId: "openai/test",
			pricing: "token",
			usage: { inputTokens: 100, outputTokens: 30 },
		});

		// 75,000 cost micros / 28,000 per credit = ceil(267.86) = 268 cc.
		expect(settled).toMatchObject({
			finalCredits: 268,
			pricingSnapshot: { usdMicrosPerCredit: 28_000 },
			status: "settled",
		});
	});

	it("replays a settled token request without consulting volatile model pricing", async () => {
		const { credits, pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:token-replay",
		});
		const settlement = {
			modelId: "openai/test",
			pricing: "token" as const,
			provider: "openai",
			rawUsage: { finishReason: "stop", inputTokens: 100, outputTokens: 30 },
			usage: {
				inputTokenDetails: {
					cacheReadTokens: 20,
					cacheWriteTokens: 5,
					noCacheTokens: 75,
				},
				inputTokens: 100,
				outputTokens: 30,
			},
		};
		const settled = await service.settle(CHAT_EVENT_ID, settlement);
		pricing.quote = {
			...pricing.quote,
			costUsdMicros: 500_000,
			credits: 1_000,
			pricingSnapshot: {
				...pricing.quote.pricingSnapshot,
				refreshedAt: "2026-08-02T00:00:00.000Z",
				source: "seed",
			},
		};

		await expect(service.settle(CHAT_EVENT_ID, settlement)).resolves.toEqual(
			settled,
		);
		expect(pricing.quoteCalls).toBe(1);
		expect(credits.consumeCalls).toHaveLength(2);

		await expect(
			service.settle(CHAT_EVENT_ID, {
				...settlement,
				rawUsage: { finishReason: "stop", inputTokens: 101, outputTokens: 30 },
				usage: { ...settlement.usage, inputTokens: 101 },
			}),
		).rejects.toThrow("settle replay conflict");
		await expect(
			service.settle(CHAT_EVENT_ID, {
				...settlement,
				usage: {
					...settlement.usage,
					inputTokenDetails: {
						...settlement.usage.inputTokenDetails,
						noCacheTokens: 74,
					},
				},
			}),
		).rejects.toThrow("settle replay conflict");
		expect(pricing.quoteCalls).toBe(1);
	});

	it("validates a reconciled token replay from durable settlement evidence without re-quoting", async () => {
		const { gateway, pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:reconciled-token-replay",
		});
		const settlement = {
			modelId: "openai/test",
			pricing: "token" as const,
			provider: "openai",
			rawUsage: { finishReason: "stop", inputTokens: 100, outputTokens: 30 },
			usage: {
				inputTokenDetails: {
					cacheReadTokens: 20,
					cacheWriteTokens: 5,
					noCacheTokens: 75,
				},
				inputTokens: 100,
				outputTokens: 30,
			},
		};
		await service.settle(CHAT_EVENT_ID, settlement);
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_token_replay" } },
		});
		gateway.results.set(
			"gen_token_replay",
			generationInfo("gen_token_replay", 0.1),
		);
		const { event } = await service.reconcile(CHAT_EVENT_ID);
		pricing.quote = {
			...pricing.quote,
			costUsdMicros: 500_000,
			credits: 1_000,
			pricingSnapshot: {
				...pricing.quote.pricingSnapshot,
				refreshedAt: "2026-08-02T00:00:00.000Z",
				source: "seed",
			},
		};

		await expect(service.settle(CHAT_EVENT_ID, settlement)).resolves.toEqual(
			event,
		);
		expect(pricing.quoteCalls).toBe(1);

		await expect(
			service.settle(CHAT_EVENT_ID, {
				...settlement,
				rawUsage: { finishReason: "stop", inputTokens: 101, outputTokens: 30 },
				usage: { ...settlement.usage, inputTokens: 101 },
			}),
		).rejects.toThrow("settle replay conflict");
		expect(pricing.quoteCalls).toBe(1);
	});

	it("captures a runtime-narrowed gateway generation exactly once", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});

		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "gen_1" } },
				stepUsage: { inputTokens: 3 },
			}),
		).resolves.toMatchObject({ gatewayGenerationId: "gen_1" });
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_1" } },
		});
		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "gen_1" } },
				stepUsage: { inputTokens: 4 },
			}),
		).rejects.toThrow("Gateway generation gen_1 has conflicting step usage");
		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: 123 } },
			}),
		).resolves.toBeNull();
		expect(repository.refs).toHaveLength(1);
	});

	it("monotonically enriches an ID-only generation replay with step usage", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:generation-enrichment",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_enriched" } },
		});

		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "gen_enriched" } },
				stepUsage: { inputTokens: 3 },
			}),
		).resolves.toMatchObject({ stepUsage: { inputTokens: 3 } });
		expect(repository.refs).toHaveLength(1);
	});

	it("batch-reconciles only after capture and settlement are both durable", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_1" } },
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		gateway.results.set("gen_1", generationInfo("gen_1", 0.05));

		await expect(
			service.recoverUnreconciledSettled(new Date("2100-01-01")),
		).resolves.toMatchObject({ reconciled: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
	});

	it("routes OpenRouter captures to reconciliation under their own source", async () => {
		const { gateway, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		// The OpenRouter model wrapper writes the id under `openrouter`, not
		// `gateway`; capture must record the ref with its provider source.
		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { openrouter: { generationId: "gen-or-1" } },
			}),
		).resolves.toMatchObject({
			gatewayGenerationId: "gen-or-1",
			providerSource: "openrouter",
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		gateway.results.set("gen-or-1", generationInfo("gen-or-1", 0.05));

		await expect(service.reconcile(CHAT_EVENT_ID)).resolves.toMatchObject({
			event: expect.objectContaining({ status: "reconciled" }),
		});
		expect(gateway.calls).toEqual([{ id: "gen-or-1", source: "openrouter" }]);
	});

	it("keeps a late capture batch-selectable without any per-event handoff", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		await expect(
			service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "gen_late" } },
			}),
		).resolves.toMatchObject({ gatewayGenerationId: "gen_late" });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("settled");
		expect(repository.refs).toHaveLength(1);
		gateway.results.set("gen_late", generationInfo("gen_late", 0.05));
		await expect(
			service.recoverUnreconciledSettled(new Date("2100-01-01")),
		).resolves.toMatchObject({ reconciled: 1, scanned: 1 });
	});

	it("reconciles authoritative multi-generation cost and token totals", async () => {
		const { credits, gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 500,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 300,
			pricing: "direct",
			pricingSnapshot: {
				mode: "token",
				quotedCredits: 300,
				source: "estimate",
			},
			rawUsage: { inputTokens: 90, source: "finish-event" },
		});
		for (const id of ["gen_1", "gen_2"]) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
			});
		}
		gateway.results.set("gen_1", generationInfo("gen_1", 0.1));
		gateway.results.set("gen_2", generationInfo("gen_2", 0.150_001));

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result).toMatchObject({
			adjustedCredits: 201,
			reconciledCostUsdMicros: 250_001,
		});
		expect(result.event).toMatchObject({
			cacheReadTokens: 14,
			cacheWriteTokens: 6,
			finalCredits: 501,
			inputTokens: 200,
			outputTokens: 80,
			status: "reconciled",
		});
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: {
				source: "gateway_reconciliation",
				usdMicrosPerCredit: 50_000,
			},
			mode: "token",
			quotedCredits: 300,
			source: "estimate",
			settlementPricingSnapshot: {
				costUsdMicros: null,
				mode: "token",
				quotedCredits: 300,
				source: "estimate",
			},
		});
		expect(result.event.rawUsage).toMatchObject({
			inputTokens: 90,
			settlementRawUsage: {
				inputTokens: 90,
				source: "finish-event",
			},
			source: "finish-event",
		});
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			allowOverdraft: true,
			amount: 201,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
		expect(
			[...repository.refs.values()].every(
				(ref) => ref.reconciledCostUsdMicros !== null,
			),
		).toBe(true);
	});

	it("ceil-bills the aggregate raw gateway cost without per-ref round-down", async () => {
		const { credits, gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:fractional-micros",
		});
		for (const id of ["gen_fraction_1", "gen_fraction_2"]) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
			});
			gateway.results.set(id, generationInfo(id, 0.025_000_4));
		}

		const result = await service.reconcile(CHAT_EVENT_ID);
		const refCosts = [...repository.refs.values()].map(
			(ref) => ref.reconciledCostUsdMicros,
		);

		expect(result).toMatchObject({
			adjustedCredits: 1,
			reconciledCostUsdMicros: 50_001,
		});
		expect(result.event.finalCredits).toBe(101);
		expect(refCosts).toEqual([25_001, 25_000]);
		expect(
			refCosts.reduce<number>((total, cost) => total + (cost ?? 0), 0),
		).toBe(result.reconciledCostUsdMicros);
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			amount: 1,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: {
				generations: [
					{ costUsdMicros: 25_001, totalCostUsd: 0.025_000_4 },
					{ costUsdMicros: 25_000, totalCostUsd: 0.025_000_4 },
				],
			},
		});
	});

	it("adds decimal gateway totals without binary-float overbilling", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:decimal-aggregate",
		});
		for (const [id, cost] of [
			["gen_decimal_1", 0.1],
			["gen_decimal_2", 0.2],
		] as const) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
			});
			gateway.results.set(id, generationInfo(id, cost));
		}

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.reconciledCostUsdMicros).toBe(300_000);
		expect(result.event.finalCredits).toBe(600);
		expect(
			[...repository.refs.values()].reduce(
				(total, ref) => total + (ref.reconciledCostUsdMicros ?? 0),
				0,
			),
		).toBe(300_000);
	});

	it("rejects an aggregate gateway cost outside the database integer range", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:cost-overflow",
		});
		for (const id of ["gen_large_1", "gen_large_2"]) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
			});
			gateway.results.set(id, generationInfo(id, 1_200));
		}

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toThrow(
			"Aggregate gateway cost exceeds the USD-micros database integer range",
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		expect(
			[...repository.refs.values()].every(
				(ref) => ref.reconciledCostUsdMicros === null,
			),
		).toBe(true);
	});

	it("reconciles a settled token event with its durable debit-time conversion rate", async () => {
		const { credits, gateway, pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:settled-rate-snapshot",
		});
		await service.settle(CHAT_EVENT_ID, {
			modelId: "openai/test",
			pricing: "token",
			usage: { inputTokens: 10, outputTokens: 2 },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_settled_rate" } },
		});
		gateway.results.set(
			"gen_settled_rate",
			generationInfo("gen_settled_rate", 0.075),
		);
		pricing.usdMicrosPerCredit = 100_000;

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(150);
		expect(result.adjustedCredits).toBe(0);
		expect(credits.consumeCalls).toHaveLength(2);
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: { usdMicrosPerCredit: 50_000 },
			settlementPricingSnapshot: { usdMicrosPerCredit: 50_000 },
		});
	});

	it("reconciles a crash-stranded token reserve with its durable reservation rate", async () => {
		const { credits, gateway, pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:reserved-rate-snapshot",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_reserved_rate" } },
		});
		gateway.results.set(
			"gen_reserved_rate",
			generationInfo("gen_reserved_rate", 0.075),
		);
		pricing.usdMicrosPerCredit = 100_000;

		const result = await service.reconcile(CHAT_EVENT_ID);
		const replay = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(150);
		expect(result.adjustedCredits).toBe(50);
		expect(replay.event).toEqual(result.event);
		expect(replay.adjustedCredits).toBe(0);
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			amount: 50,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: { usdMicrosPerCredit: 50_000 },
			reservationPricingSnapshot: {
				mode: "token",
				source: "operation_registry_reservation",
				usdMicrosPerCredit: 50_000,
			},
		});
	});

	it("uses durable fixed registry terms for crash recovery and settlement replay after price drift", async () => {
		const { gateway, repository, service } = setup();
		const event = await service.reserve("image", USER_SUBJECT, {
			credits: 1400,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:reserved-registry-snapshot",
		});
		repository.events.set(event.id, {
			...event,
			pricingSnapshot: legacyFixedReservationSnapshot("image", 700),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_fixed_drift" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});
		gateway.results.set(
			"gen_fixed_drift",
			generationInfo("gen_fixed_drift", 0.1),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(1400);
		expect(result.event.pricingSnapshot).toMatchObject({
			creditsPerUnit: 700,
			reservationPricingSnapshot: { creditsPerUnit: 700 },
			units: 2,
		});
		await expect(
			service.settle(CHAT_EVENT_ID, {
				finalCredits: 1400,
				pricing: "direct",
				pricingSnapshot: {
					creditsPerUnit: 700,
					mode: "fixed",
					operation: "image",
					source: "operation_registry",
					unit: "image",
					units: 2,
				},
			}),
		).resolves.toEqual(result.event);
	});

	it("uses durable per-minute terms for crash recovery after registry drift", async () => {
		const { gateway, repository, service } = setup();
		const event = await service.reserve("transcription", USER_SUBJECT, {
			credits: 400,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:reserved-registry-snapshot",
		});
		repository.events.set(event.id, {
			...event,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(200),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_duration_drift" } },
			stepUsage: { durationSeconds: 90 },
		});
		gateway.results.set(
			"gen_duration_drift",
			generationInfo("gen_duration_drift", 0.1),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(400);
		expect(result.event.pricingSnapshot).toMatchObject({
			creditsPerMinute: 200,
			durationSeconds: 90,
			reservationPricingSnapshot: { creditsPerMinute: 200 },
		});
	});

	it("reprices a crash-stranded measured reserve from the exact gateway cost", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 700,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:attempt_1",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 2 },
		});
		for (const id of ["gen_image_1", "gen_image_2"]) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
				stepUsage: { metering: { fixedUnits: 1 } },
			});
			gateway.results.set(id, generationInfo(id, 0.6));
		}

		const result = await service.reconcile(CHAT_EVENT_ID);

		// $1.20 at the 50,000-micro anchor: 2,400 cc, debited above the hold.
		expect(result).toMatchObject({
			adjustedCredits: 1700,
			reconciledCostUsdMicros: 1_200_000,
		});
		expect(result.event).toMatchObject({
			finalCredits: 2400,
			operation: "image",
			pricingSnapshot: {
				estimatedUnitUsdMicros: 134_400,
				gatewayReconciliation: { customerBillableCostUsdMicros: 1_200_000 },
				mode: "measured",
				operation: "image",
				source: "operation_registry_recovery",
				unit: "image",
				units: 2,
			},
			status: "reconciled",
		});
		expect(credits.consumeCalls).toHaveLength(2);
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			amount: 1700,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
		expect(credits.refundCalls).toHaveLength(0);
		// A late provisional settlement for the same operation is a benign replay.
		await expect(
			service.settle(CHAT_EVENT_ID, measuredSettlement("image", 2, 134_400)),
		).resolves.toEqual(result.event);
		await expect(
			service.settle(CHAT_EVENT_ID, measuredSettlement("video", 1, 134_400)),
		).rejects.toThrow("settle replay conflict");
	});

	it("adjusts a settled measured event up or down to the customer-billable cost", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("video", USER_SUBJECT, {
			credits: 550,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "video:up",
			measuredTerms: { estimatedUnitUsdMicros: 210_000, units: 1 },
		});
		await service.settle(
			CHAT_EVENT_ID,
			measuredSettlement("video", 1, 210_000),
		);
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_video_up" } },
			stepUsage: { metering: { fixedUnits: 1 } },
		});
		gateway.results.set("gen_video_up", generationInfo("gen_video_up", 0.3));

		const up = await service.reconcile(CHAT_EVENT_ID);

		// settled 420 cc ($0.21) → $0.30 = 600 cc: +180 via overdraft consume.
		expect(up).toMatchObject({ adjustedCredits: 180 });
		expect(up.event.finalCredits).toBe(600);
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			allowOverdraft: true,
			amount: 180,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
		expect(up.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: { customerBillableCostUsdMicros: 300_000 },
			settlementPricingSnapshot: {
				outcome: "delivered",
				source: "measured_local",
			},
		});

		await service.reserve("video", USER_SUBJECT, {
			credits: 550,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "video:down",
			measuredTerms: { estimatedUnitUsdMicros: 300_000, units: 1 },
		});
		await service.settle(
			CHILD_EVENT_ID,
			measuredSettlement("video", 1, 300_000),
		);
		await service.captureGeneration(CHILD_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_video_down" } },
			stepUsage: { metering: { fixedUnits: 1 } },
		});
		gateway.results.set(
			"gen_video_down",
			generationInfo("gen_video_down", 0.1),
		);

		const down = await service.reconcile(CHILD_EVENT_ID);

		// settled 600 cc → $0.10 = 200 cc: refund 50 from settle, 350 from reserve.
		expect(down).toMatchObject({ adjustedCredits: -400 });
		expect(down.event.finalCredits).toBe(200);
		expect(credits.refundCalls.slice(-2)).toEqual([
			expect.objectContaining({
				amount: 50,
				idempotencyKey: `reconcile-refund:${CHILD_EVENT_ID}:settle`,
			}),
			expect.objectContaining({
				amount: 350,
				idempotencyKey: `reconcile-refund:${CHILD_EVENT_ID}:reserve`,
			}),
		]);
	});

	it("keeps a failed measured generation at zero and books its cost to provider spend", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:failed",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 1 },
		});
		await service.settle(CHAT_EVENT_ID, {
			...measuredSettlement("image", 0, 134_400),
			costUsdMicros: 134_400,
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_image_failed" } },
			stepUsage: {
				metering: { customerBilling: "refunded_failure", fixedUnits: 0 },
				providerUsage: null,
			},
		});
		gateway.results.set(
			"gen_image_failed",
			generationInfo("gen_image_failed", 0.1344),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result).toMatchObject({
			adjustedCredits: 0,
			reconciledCostUsdMicros: 134_400,
		});
		expect(result.event).toMatchObject({
			finalCredits: 0,
			reconciledCostUsdMicros: 134_400,
			status: "reconciled",
		});
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: {
				customerBillableCostUsdMicros: 0,
				generations: [{ customerBilling: "refunded_failure" }],
			},
		});
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 350,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
	});

	it("excludes refunded-failure refs from the customer charge but not the provider cost", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 700,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:partial-failure",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 2 },
		});
		await service.settle(CHAT_EVENT_ID, {
			...measuredSettlement("image", 1, 134_400, { outcome: "partial" }),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_ok" } },
			stepUsage: { metering: { fixedUnits: 1 }, providerUsage: null },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_failed" } },
			stepUsage: {
				metering: { customerBilling: "refunded_failure", fixedUnits: 0 },
				providerUsage: null,
			},
		});
		gateway.results.set("gen_ok", generationInfo("gen_ok", 0.2));
		gateway.results.set("gen_failed", generationInfo("gen_failed", 0.2));

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.reconciledCostUsdMicros).toBe(400_000);
		expect(result.event.finalCredits).toBe(400);
		expect(result.event.pricingSnapshot).toMatchObject({
			gatewayReconciliation: { customerBillableCostUsdMicros: 200_000 },
		});
	});

	describe("provider call evidence", () => {
		const serperEvidence = (
			units: number,
			overrides: Partial<ProviderCallEvidenceInput> = {},
		): ProviderCallEvidenceInput => ({
			chargedUsdMicros: units * 1_000,
			costSource: "serper_contract_env",
			costStatus: "contract_rate",
			customerBillable: false,
			idempotencyKey: "serper:attempt_1",
			rateUsdMicrosPerUnit: 1_000,
			transport: "serper",
			unitKind: "search_page",
			units,
			...overrides,
		});

		it("captures evidence on a refunded event and refuses a reconciled one", async () => {
			const { repository, service } = setup();
			await service.reserve("lead_scrape", USER_SUBJECT, {
				credits: 250,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "lead-scrape:attempt_1",
			});
			await service.refundWithProviderCost(
				CHAT_EVENT_ID,
				3_000,
				"lead_scrape_failed",
			);

			const captured = await service.captureProviderCallEvidence(
				CHAT_EVENT_ID,
				serperEvidence(3),
			);

			expect(captured).toMatchObject({
				chargedUsdMicros: 3_000,
				costStatus: "contract_rate",
				customerBillable: false,
				usageEventId: CHAT_EVENT_ID,
			});
			// Idempotent replay returns the same row.
			await expect(
				service.captureProviderCallEvidence(CHAT_EVENT_ID, serperEvidence(3)),
			).resolves.toEqual(captured);
			expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("refunded");

			repository.events.set(CHAT_EVENT_ID, {
				...(repository.events.get(CHAT_EVENT_ID) as AiUsageEvent),
				status: "reconciled",
			});
			await expect(
				service.captureProviderCallEvidence(
					CHAT_EVENT_ID,
					serperEvidence(1, { idempotencyKey: "serper:attempt_late" }),
				),
			).rejects.toBeInstanceOf(MeteringStateConflictError);
		});

		it("settles evidence cost monotonically and never downgrades the status", async () => {
			const { service } = setup();
			await service.reserve("lead_scrape", USER_SUBJECT, {
				credits: 250,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "lead-scrape:attempt_1",
			});
			const row = await service.captureProviderCallEvidence(
				CHAT_EVENT_ID,
				serperEvidence(1, { chargedUsdMicros: null, costStatus: "pending" }),
			);

			const priced = await service.settleProviderCallEvidenceCost(row.id, {
				chargedUsdMicros: 4_000,
				costStatus: "contract_rate",
				rateUsdMicrosPerUnit: 1_000,
				units: 4,
			});
			expect(priced).toMatchObject({
				chargedUsdMicros: 4_000,
				costStatus: "contract_rate",
				units: 4,
			});

			// Lower unit count is ignored; estimated never replaces contract_rate.
			await expect(
				service.settleProviderCallEvidenceCost(row.id, {
					chargedUsdMicros: 2_000,
					costStatus: "contract_rate",
					units: 2,
				}),
			).resolves.toMatchObject({ chargedUsdMicros: 2_000, units: 4 });
			await expect(
				service.settleProviderCallEvidenceCost(row.id, {
					chargedUsdMicros: 1,
					costStatus: "estimated",
				}),
			).resolves.toMatchObject({
				chargedUsdMicros: 2_000,
				costStatus: "contract_rate",
			});
		});

		it("reconciles an evidence-only settled lead scrape from its Serper receipt", async () => {
			const { credits, service } = setup();
			await service.reserve("lead_scrape", USER_SUBJECT, {
				credits: 250,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "lead-scrape:attempt_1",
			});
			await service.settle(CHAT_EVENT_ID, {
				costUsdMicros: 2_000,
				finalCredits: 150,
				pricing: "direct",
				pricingSnapshot: { mode: "fixed", operation: "lead_scrape", units: 30 },
			});
			await service.captureProviderCallEvidence(
				CHAT_EVENT_ID,
				serperEvidence(2),
			);

			const outcome = await service.reconcile(CHAT_EVENT_ID);

			expect(outcome).toMatchObject({
				adjustedCredits: 0,
				reconciledCostUsdMicros: 2_000,
			});
			expect(outcome.event).toMatchObject({
				finalCredits: 150,
				model: null,
				reconciledCostUsdMicros: 2_000,
				status: "reconciled",
			});
			expect(outcome.event.pricingSnapshot).toMatchObject({
				gatewayReconciliation: {
					customerBillableCostUsdMicros: 0,
					providerCallEvidence: [
						expect.objectContaining({
							chargedUsdMicros: 2_000,
							transport: "serper",
							units: 2,
						}),
					],
				},
			});
			expect(credits.balances.get(USER_ID)).toBe(9_850);
		});

		it("holds reconciliation while evidence is pending, then sums it next to gateway refs", async () => {
			const { gateway, service } = setup();
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:with-evidence",
			});
			await service.settle(CHAT_EVENT_ID, {
				modelId: "openai/test",
				pricing: "token",
				usage: { inputTokens: 10, outputTokens: 2 },
			});
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "chat-generation" } },
			});
			gateway.results.set(
				"chat-generation",
				generationInfo("chat-generation", 0.05),
			);
			const pending = await service.captureProviderCallEvidence(CHAT_EVENT_ID, {
				costStatus: "pending",
				customerBillable: true,
				idempotencyKey: "mcp:ref-1:submit",
				transport: "mcp",
				unitKind: "operation",
				units: 1,
			});

			await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toBeInstanceOf(
				GatewayUsagePendingError,
			);

			await service.settleProviderCallEvidenceCost(pending.id, {
				chargedUsdMicros: 10_000,
				costStatus: "measured",
			});
			await service.captureProviderCallEvidence(CHAT_EVENT_ID, {
				chargedUsdMicros: 5_000,
				costStatus: "measured",
				customerBillable: false,
				idempotencyKey: "higgsfield:ref-1:job-1",
				transport: "higgsfield",
				unitKind: "video",
				units: 1,
			});

			const outcome = await service.reconcile(CHAT_EVENT_ID);

			// 50_000 gateway + 10_000 billable + 5_000 non-billable provider spend.
			expect(outcome.reconciledCostUsdMicros).toBe(65_000);
			expect(outcome.event.pricingSnapshot).toMatchObject({
				gatewayReconciliation: { customerBillableCostUsdMicros: 60_000 },
			});
			expect(outcome.event.finalCredits).toBe(120);
		});

		it("bills helper_billable refs inside the parent while legacy bundled refs stay free", async () => {
			const { gateway, service } = setup();
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:helpers",
			});
			await service.settle(CHAT_EVENT_ID, {
				modelId: "openai/test",
				pricing: "token",
				usage: { inputTokens: 10, outputTokens: 2 },
			});
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "chat-generation" } },
			});
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "repair-generation" } },
				stepUsage: helperStepUsage("tool_call_repair", { inputTokens: 5 }),
			});
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: "legacy-title" } },
				stepUsage: bundledUnmeteredStepUsage("project_title", null),
			});
			gateway.results.set(
				"chat-generation",
				generationInfo("chat-generation", 0.04),
			);
			gateway.results.set(
				"repair-generation",
				generationInfo("repair-generation", 0.02),
			);
			gateway.results.set("legacy-title", generationInfo("legacy-title", 0.5));

			const outcome = await service.reconcile(CHAT_EVENT_ID);

			expect(outcome.reconciledCostUsdMicros).toBe(560_000);
			expect(outcome.event.finalCredits).toBe(120);
			expect(outcome.event.pricingSnapshot).toMatchObject({
				gatewayReconciliation: {
					customerBillableCostUsdMicros: 60_000,
					generations: expect.arrayContaining([
						expect.objectContaining({
							customerBilling: "helper_billable",
							id: "repair-generation",
						}),
						expect.objectContaining({
							customerBilling: "bundled_unmetered_legacy",
							id: "legacy-title",
						}),
					]),
				},
			});
		});
	});

	it("refunds a hold in full while recording the provider cost it consumed", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("lead_scrape", USER_SUBJECT, {
			credits: 250,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "lead-scrape:attempt_1",
		});

		const refunded = await service.refundWithProviderCost(
			CHAT_EVENT_ID,
			3_000,
			"lead_scrape_failed",
		);

		expect(refunded).toMatchObject({
			finalCredits: 0,
			pricingSnapshot: {
				costUsdMicros: 3_000,
				reason: "lead_scrape_failed",
				source: "refund_with_provider_cost",
			},
			reconciledCostUsdMicros: 3_000,
			status: "refunded",
		});
		expect(refunded.reconciledAt).toBeInstanceOf(Date);
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 250,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(10_000);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("refunded");
		await expect(
			service.refundWithProviderCost(
				CHAT_EVENT_ID,
				3_000,
				"lead_scrape_failed",
			),
		).resolves.toEqual(refunded);
	});

	it("allows a zero-unit direct settlement to refund an empty fixed result", async () => {
		const { credits, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:empty-result",
		});

		const settled = await service.settle(
			CHAT_EVENT_ID,
			measuredSettlement("image", 0, null),
		);

		expect(settled).toMatchObject({ finalCredits: 0, status: "settled" });
		expect(credits.refundCalls.at(-1)).toMatchObject({
			amount: 350,
			idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
		});
	});

	it("atomically settles fixed recovery from the larger stored/provider unit count", async () => {
		const { credits, repository, service } = setup();
		const reserved = await service.reserve("image", USER_SUBJECT, {
			credits: 800,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:fixed-evidence-recovery",
		});
		repository.events.set(reserved.id, {
			...reserved,
			pricingSnapshot: legacyFixedReservationSnapshot("image", 400),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_fixed_evidence" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});

		const settled = await service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 1);
		const replay = await service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 1);

		expect(settled).toMatchObject({
			finalCredits: 800,
			pricingSnapshot: {
				creditsPerUnit: 400,
				operation: "image",
				units: 2,
			},
			status: "settled",
		});
		expect(replay).toEqual(settled);
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.refundCalls).toHaveLength(0);
	});

	it("uses the stored measured prefix when it exceeds provider evidence", async () => {
		const { service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 1050,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:stored-prefix-recovery",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 3 },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_stored_prefix" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});

		// 3 × $0.1344 = $0.4032 at the 50,000-micro anchor → 807 cc.
		await expect(
			service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 3),
		).resolves.toMatchObject({
			finalCredits: 807,
			pricingSnapshot: {
				costUsdMicros: 403_200,
				estimatedUnitUsdMicros: 134_400,
				mode: "measured",
				source: "measured_local",
				units: 3,
			},
			status: "settled",
		});
	});

	it("settles measured evidence at the floor when the hold carries no estimate", async () => {
		const { service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 700,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:floor-evidence",
			measuredTerms: { estimatedUnitUsdMicros: null, units: 2 },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_floor_evidence" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});

		await expect(
			service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 0),
		).resolves.toMatchObject({
			finalCredits: 200,
			pricingSnapshot: { costUsdMicros: null, units: 2 },
			status: "settled",
		});
	});

	it("financially finalizes an unpriced reconcile-failed fixed event without reopening reconciliation", async () => {
		const { credits, repository, service } = setup();
		const reserved = await service.reserve("image", USER_SUBJECT, {
			credits: 1600,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:reconcile-failed-fixed-recovery",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyFixedReservationSnapshot("image", 400),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: {
				gateway: { generationId: "gen_reconcile_failed_fixed" },
			},
			stepUsage: { metering: { fixedUnits: 2 } },
		});
		const terminal =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		const settled = await service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 1);
		const replay = await service.settleMeasuredFromEvidence(CHAT_EVENT_ID, 3);

		expect(settled).toMatchObject({
			finalCredits: 800,
			pricingSnapshot: {
				creditsPerUnit: 400,
				operation: "image",
				units: 2,
			},
			reconciledAt: terminal.reconciledAt,
			status: "reconcile_failed",
		});
		expect(settled.settledAt).toBeInstanceOf(Date);
		expect(replay).toEqual(settled);
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 800,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
	});

	it("reconciles a crash-stranded legacy four-image reserve from one durable unit ref", async () => {
		const { credits, gateway, repository, service } = setup();
		const reserved = await service.reserve("image", USER_SUBJECT, {
			credits: 1200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:partial-crash",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyFixedReservationSnapshot("image", 300),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_image_partial" } },
			stepUsage: {
				metering: { fixedUnits: 1 },
				providerUsage: { inputTokens: 1 },
			},
		});
		gateway.results.set(
			"gen_image_partial",
			generationInfo("gen_image_partial", 0.6),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event).toMatchObject({
			finalCredits: 300,
			pricingSnapshot: {
				creditsPerUnit: 300,
				mode: "fixed",
				operation: "image",
				units: 1,
			},
			status: "reconciled",
		});
		expect(credits.refundCalls.at(-1)).toMatchObject({
			amount: 900,
			idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
		});
	});

	it("accepts zero-unit settlement replay when reconciliation wins the race", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:empty-race",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 1 },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_image_empty" } },
			stepUsage: {
				metering: { fixedUnits: 0 },
				providerUsage: null,
			},
		});
		gateway.results.set(
			"gen_image_empty",
			generationInfo("gen_image_empty", 0.2),
		);

		// Zero completed units with a real cost: nothing delivered, nothing owed.
		const reconciled = await service.reconcile(CHAT_EVENT_ID);
		expect(reconciled.event).toMatchObject({
			finalCredits: 0,
			reconciledCostUsdMicros: 200_000,
			status: "reconciled",
		});
		await expect(
			service.settle(CHAT_EVENT_ID, measuredSettlement("image", 0, 134_400)),
		).resolves.toEqual(reconciled.event);
	});

	it("preserves fixed settlement pricing and raw usage during reconciliation", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 600,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:settled",
		});
		const settlement = {
			finalCredits: 600,
			pricing: "direct" as const,
			pricingSnapshot: {
				creditsPerUnit: 300,
				mode: "fixed",
				operation: "image",
				source: "operation_registry",
				unit: "image",
				units: 2,
			},
			rawUsage: { deliveredImages: 2 },
		};
		await service.settle(CHAT_EVENT_ID, settlement);
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_settled_image" } },
			stepUsage: { deliveredImages: 2 },
		});
		gateway.results.set(
			"gen_settled_image",
			generationInfo("gen_settled_image", 0.4),
		);

		const { event } = await service.reconcile(CHAT_EVENT_ID);

		expect(event.pricingSnapshot).toMatchObject({
			creditsPerUnit: 300,
			mode: "fixed",
			operation: "image",
			source: "operation_registry",
			unit: "image",
			units: 2,
		});
		expect(event.rawUsage).toMatchObject({
			deliveredImages: 2,
			settlementRawUsage: { deliveredImages: 2 },
		});
		await expect(service.settle(CHAT_EVENT_ID, settlement)).resolves.toEqual(
			event,
		);
		await expect(
			service.settle(CHAT_EVENT_ID, {
				...settlement,
				pricingSnapshot: { ...settlement.pricingSnapshot, units: 1 },
			}),
		).rejects.toThrow("settle replay conflict");
		await expect(
			service.settle(CHAT_EVENT_ID, {
				...settlement,
				rawUsage: { deliveredImages: 1 },
			}),
		).rejects.toThrow("settle replay conflict");
	});

	it("reconstructs legacy per-minute pricing and preserves captured duration evidence", async () => {
		const { gateway, repository, service } = setup();
		const reserved = await service.reserve("transcription", USER_SUBJECT, {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:operation_1",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(100),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: {
				gateway: { generationId: "gen_transcription" },
			},
			stepUsage: {
				durationSeconds: 61,
				providerDurationSeconds: 60,
			},
		});
		gateway.results.set(
			"gen_transcription",
			generationInfo("gen_transcription", 0.03),
		);

		const { event } = await service.reconcile(CHAT_EVENT_ID);

		expect(event).toMatchObject({
			finalCredits: 100,
			pricingSnapshot: {
				authoritativeDurationSeconds: 60,
				creditsPerMinute: 100,
				durationCapped: false,
				durationSeconds: 60,
				finalCredits: 100,
				maxDurationSeconds: 300,
				minimumCredits: 100,
				mode: "per_minute",
				operation: "transcription",
				providerDurationSeconds: 60,
				source: "operation_registry_recovery",
				unit: "minute",
				units: 1,
			},
			status: "reconciled",
		});
		expect(event.rawUsage).toMatchObject({
			generationRefs: [
				{
					gatewayGenerationId: "gen_transcription",
					stepUsage: {
						durationSeconds: 61,
						providerDurationSeconds: 60,
					},
				},
			],
		});
	});

	it("falls back to positive local duration when provider duration is invalid", async () => {
		const { gateway, repository, service } = setup();
		const reserved = await service.reserve("transcription", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:local-duration",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(100),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_local_duration" } },
			stepUsage: { durationSeconds: 121, providerDurationSeconds: 0 },
		});
		gateway.results.set(
			"gen_local_duration",
			generationInfo("gen_local_duration", 0.03),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result).toMatchObject({ adjustedCredits: 200 });
		expect(result.event).toMatchObject({
			finalCredits: 300,
			pricingSnapshot: {
				authoritativeDurationSeconds: 121,
				durationCapped: false,
				durationEvidence: [
					{
						authoritativeDurationSeconds: 121,
						durationSeconds: 121,
						providerDurationSeconds: null,
						source: "local",
					},
				],
				durationSeconds: 121,
				units: 3,
			},
		});
	});

	it("caps provider duration for billing while retaining the over-cap evidence", async () => {
		const { credits, gateway, repository, service } = setup();
		const reserved = await service.reserve("transcription", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:provider-over-cap",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(100),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_provider_over_cap" } },
			stepUsage: { durationSeconds: 45, providerDurationSeconds: 360 },
		});
		gateway.results.set(
			"gen_provider_over_cap",
			generationInfo("gen_provider_over_cap", 0.03),
		);

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result).toMatchObject({ adjustedCredits: 400 });
		expect(result.event).toMatchObject({
			finalCredits: 500,
			pricingSnapshot: {
				authoritativeDurationSeconds: 360,
				durationCapped: true,
				durationEvidence: [
					{
						authoritativeDurationSeconds: 360,
						durationSeconds: 45,
						providerDurationSeconds: 360,
						source: "provider",
					},
				],
				durationSeconds: 300,
				providerDurationSeconds: 360,
				units: 5,
			},
			rawUsage: {
				generationRefs: [
					{
						stepUsage: {
							durationSeconds: 45,
							providerDurationSeconds: 360,
						},
					},
				],
			},
		});
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			amount: 400,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
	});

	it("fails closed when a legacy reserved transcription lacks positive duration evidence", async () => {
		const { credits, gateway, repository, service } = setup();
		const reserved = await service.reserve("transcription", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:missing-duration",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(100),
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_missing_duration" } },
			stepUsage: { durationSeconds: 0, providerDurationSeconds: null },
		});
		gateway.results.set(
			"gen_missing_duration",
			generationInfo("gen_missing_duration", 0.03),
		);

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toThrow(
			"lacks valid positive transcription duration evidence",
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		expect([...repository.refs.values()][0]?.reconciledAt).toBeNull();
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.refundCalls).toHaveLength(0);
	});

	it("retains a legacy settled transcription debit when reconciliation duration is invalid", async () => {
		const { gateway, repository, service } = setup();
		const reserved = await service.reserve("transcription", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:settled-duration",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyPerMinuteReservationSnapshot(100),
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 200,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerMinute: 100,
				durationSeconds: 120,
				mode: "per_minute",
			},
			rawUsage: { durationSeconds: 120 },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_settled_duration" } },
			stepUsage: { durationSeconds: 0, providerDurationSeconds: null },
		});
		gateway.results.set(
			"gen_settled_duration",
			generationInfo("gen_settled_duration", 0.03),
		);

		const { event } = await service.reconcile(CHAT_EVENT_ID);

		expect(event).toMatchObject({ finalCredits: 200, status: "reconciled" });
	});

	it("reconciliation refunds settled overage before the original reserve", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 500,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 800,
			pricing: "direct",
			pricingSnapshot: { source: "estimate" },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_lower" } },
		});
		gateway.results.set("gen_lower", generationInfo("gen_lower", 0.1));

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(200);
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 300,
				consumeIdempotencyKey: `settle:${CHAT_EVENT_ID}`,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:settle`,
			}),
			expect.objectContaining({
				amount: 300,
				consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(9_800);
	});

	it("retries gateway usage-not-found without marking reconciliation failed", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_pending" } },
		});
		const pending = Object.assign(new Error("Usage event not found"), {
			statusCode: 404,
		});
		gateway.results.set("gen_pending", pending);

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toBeInstanceOf(
			GatewayUsagePendingError,
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
	});

	it("terminalizes exhausted reconciliation idempotently under the event lock", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:terminal-reconcile",
		});

		const terminal =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);
		const replay =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		expect(terminal.status).toBe("reconcile_failed");
		// A repeated terminalization is not a byte replay any more: it advances
		// the retry backoff (attempt count + next retry time) and nothing else.
		expect(terminal.reconcileAttempts).toBe(1);
		expect(replay).toEqual({
			...terminal,
			nextReconcileAttemptAt: replay.nextReconcileAttemptAt,
			reconcileAttempts: 2,
		});
		expect(repository.operationLocks).toContain(
			`metering-event:${CHAT_EVENT_ID}`,
		);

		const reconciled = {
			...terminal,
			reconciledAt: new Date("2026-08-01T00:00:00.000Z"),
			status: "reconciled" as const,
		};
		repository.events.set(CHAT_EVENT_ID, reconciled);

		await expect(
			service.terminalizeReconciliationFailure(CHAT_EVENT_ID),
		).resolves.toEqual(reconciled);
	});

	it("marks non-pending gateway reconciliation failures", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_failed" } },
		});
		gateway.results.set("gen_failed", new Error("gateway unavailable"));

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toThrow(
			"gateway unavailable",
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
	});

	it("refunds crash-stranded reserves but reconciles those with refs", async () => {
		const { credits, gateway, repository, service } = setup();
		const staleAt = new Date("2026-01-01T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 200,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:stranded",
		});
		const withRefId = "22222222-2222-4222-8222-222222222222";
		await service.reserve("chat", USER_SUBJECT, {
			credits: 200,
			eventId: withRefId,
			idempotencyKey: "chat:recoverable",
		});
		await service.captureGeneration(withRefId, {
			providerMetadata: { gateway: { generationId: "gen_recover" } },
		});
		gateway.results.set("gen_recover", generationInfo("gen_recover", 0.05));
		for (const event of repository.events.values()) {
			repository.events.set(event.id, {
				...event,
				createdAt: new Date("2025-12-31T00:00:00.000Z"),
			});
		}

		const outcome = await service.recoverStaleReservations(staleAt);

		expect(outcome).toEqual({
			failed: 0,
			pending: 0,
			reconciled: 1,
			refunded: 1,
			scanned: 2,
			skipped: 0,
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("refunded");
		expect(repository.events.get(withRefId)?.status).toBe("reconciled");
		expect(credits.refundCalls).toContainEqual(
			expect.objectContaining({
				amount: 200,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		);
	});

	it("isolates refund-branch conflicts per event instead of aborting the batch", async () => {
		const { credits, repository, service } = setup();
		const staleAt = new Date("2026-01-01T00:00:00.000Z");
		const settledBehindId = CHAT_EVENT_ID;
		const failingId = CHILD_EVENT_ID;
		const refundableId = "44444444-4444-4444-8444-444444444444";

		for (const [eventId, idempotencyKey] of [
			[settledBehindId, "chat:conflict"],
			[failingId, "chat:refund-write-failure"],
			[refundableId, "chat:still-stranded"],
		] as const) {
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId,
				idempotencyKey,
			});
		}

		const staleSnapshots = [settledBehindId, failingId, refundableId].map(
			(eventId) => {
				const event = repository.events.get(eventId);

				if (!event) {
					throw new Error(`missing stranded event ${eventId}`);
				}

				return { ...event, createdAt: new Date("2025-12-31T00:00:00.000Z") };
			},
		);
		// The first event settles between the sweep's unlocked list read and the
		// locked refund check; the second's refund write fails outright. Neither
		// may abort the batch: the third still refunds.
		repository.listStaleReserved = async () => staleSnapshots;
		await service.settle(settledBehindId, {
			finalCredits: 40,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		repository.failUpdateEventId = failingId;

		const outcome = await service.recoverStaleReservations(staleAt);

		expect(outcome).toEqual({
			failed: 1,
			pending: 1,
			reconciled: 0,
			refunded: 1,
			scanned: 3,
			skipped: 0,
		});
		expect(repository.events.get(settledBehindId)?.status).toBe("settled");
		// The failed refund write left its row reserved and sweep-selectable.
		expect(repository.events.get(failingId)?.status).toBe("reserved");
		expect(repository.events.get(refundableId)?.status).toBe("refunded");
		expect(credits.refundCalls).toContainEqual(
			expect.objectContaining({
				amount: 100,
				idempotencyKey: `settle-refund:${refundableId}`,
			}),
		);
	});

	it("refunds ref-less holds and skips ref-bearing rows when ref reconciliation is off", async () => {
		const { gateway, repository, service } = setup();
		const staleAt = new Date("2026-01-01T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:gateway-config-refund",
		});
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "chat:gateway-config-skip",
		});
		await service.captureGeneration(CHILD_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_config_skip" } },
		});
		for (const event of repository.events.values()) {
			repository.events.set(event.id, {
				...event,
				createdAt: new Date("2025-12-31T00:00:00.000Z"),
			});
		}

		const outcome = await service.recoverStaleReservations(
			staleAt,
			100,
			new Date(),
			{ reconcileRefs: false },
		);

		expect(outcome).toEqual({
			failed: 0,
			pending: 0,
			reconciled: 0,
			refunded: 1,
			scanned: 2,
			skipped: 1,
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("refunded");
		// The ref-bearing hold waits, untouched, for a gateway-configured sweep.
		expect(repository.events.get(CHILD_EVENT_ID)?.status).toBe("reserved");
		expect(gateway.calls).toHaveLength(0);
	});

	it("terminalizes a full pending recovery page on a durable age budget so later rows are reachable", async () => {
		const { gateway, repository, service } = setup(10_100);
		const staleAt = new Date("2026-08-01T00:00:00.000Z");
		const beforeBudget = new Date("2026-08-01T00:03:00.000Z");
		const afterBudget = new Date("2026-08-01T00:05:00.000Z");
		const pending = Object.assign(new Error("Usage event not found"), {
			statusCode: 404,
		});

		for (let index = 0; index < 101; index += 1) {
			const eventId = randomUUID();
			const generationId = `gen_pending_${index}`;
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId,
				idempotencyKey: `chat:pending-recovery:${index}`,
			});
			await service.captureGeneration(eventId, {
				providerMetadata: { gateway: { generationId } },
			});
			gateway.results.set(generationId, pending);
			const event = repository.events.get(eventId);

			if (!event) {
				throw new Error(`Missing pending recovery event ${eventId}`);
			}

			repository.events.set(eventId, {
				...event,
				createdAt: new Date("2026-07-31T23:19:00.000Z"),
			});
		}

		await expect(
			service.recoverStaleReservations(staleAt, 100, beforeBudget),
		).resolves.toEqual({
			failed: 0,
			pending: 100,
			reconciled: 0,
			refunded: 0,
			scanned: 100,
			skipped: 0,
		});

		await expect(
			service.recoverStaleReservations(staleAt, 100, afterBudget),
		).resolves.toEqual({
			failed: 100,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: 100,
			skipped: 0,
		});
		await expect(
			service.recoverStaleReservations(staleAt, 100, afterBudget),
		).resolves.toEqual({
			failed: 1,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: 1,
			skipped: 0,
		});
	});

	it("leaves pending recovery selectable before its age budget, then terminalizes it", async () => {
		const { gateway, repository, service } = setup();
		const staleAt = new Date("2026-08-01T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:pending-queue-failure",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_queue_failure" } },
		});
		gateway.results.set(
			"gen_queue_failure",
			Object.assign(new Error("Usage event not found"), { statusCode: 404 }),
		);
		const event = repository.events.get(CHAT_EVENT_ID);

		if (!event) {
			throw new Error("Missing pending queue-failure event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...event,
			createdAt: new Date("2026-07-31T23:19:00.000Z"),
		});

		await expect(
			service.recoverStaleReservations(
				staleAt,
				100,
				new Date("2026-08-01T00:03:00.000Z"),
			),
		).resolves.toMatchObject({ pending: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");

		await expect(
			service.recoverStaleReservations(
				staleAt,
				100,
				new Date("2026-08-01T00:05:00.000Z"),
			),
		).resolves.toMatchObject({ failed: 1, pending: 0, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
	});

	it("terminalizes non-pending sweep failures so malformed rows cannot starve later pages", async () => {
		const { gateway, repository, service } = setup();
		const staleAt = new Date("2026-08-01T00:00:00.000Z");
		const staleCreatedAt = new Date("2026-07-31T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:malformed-reserved-recovery",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_bad_reserved" } },
		});
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "chat:malformed-settled-recovery",
		});
		await service.captureGeneration(CHILD_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_bad_settled" } },
		});
		await service.settle(CHILD_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});

		for (const eventId of [CHAT_EVENT_ID, CHILD_EVENT_ID]) {
			const event = repository.events.get(eventId);

			if (!event) {
				throw new Error(`Missing malformed recovery event ${eventId}`);
			}

			repository.events.set(eventId, { ...event, createdAt: staleCreatedAt });
		}

		gateway.results.set(
			"gen_bad_reserved",
			generationInfo("gen_bad_reserved", Number.NaN),
		);
		gateway.results.set(
			"gen_bad_settled",
			generationInfo("gen_bad_settled", Number.NaN),
		);

		await expect(service.recoverStaleReservations(staleAt)).resolves.toEqual({
			failed: 1,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: 1,
			skipped: 0,
		});
		await expect(service.recoverUnreconciledSettled(staleAt)).resolves.toEqual({
			failed: 1,
			pending: 0,
			reconciled: 0,
			scanned: 1,
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
		expect(repository.events.get(CHILD_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
		await expect(
			service.recoverStaleReservations(staleAt),
		).resolves.toMatchObject({ scanned: 0 });
		await expect(
			service.recoverUnreconciledSettled(staleAt),
		).resolves.toMatchObject({ scanned: 0 });
	});

	it("keeps a failed terminal recovery write sweep-selectable", async () => {
		const { gateway, repository, service } = setup();
		const staleAt = new Date("2026-08-01T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:terminal-write-failure",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_bad_write" } },
		});
		const event = repository.events.get(CHAT_EVENT_ID);

		if (!event) {
			throw new Error("Missing terminal-write recovery event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...event,
			createdAt: new Date("2026-07-31T00:00:00.000Z"),
		});
		gateway.results.set(
			"gen_bad_write",
			generationInfo("gen_bad_write", Number.NaN),
		);
		repository.failUpdateEventId = CHAT_EVENT_ID;

		await expect(
			service.recoverStaleReservations(staleAt),
		).resolves.toMatchObject({ failed: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");
		await expect(
			service.recoverStaleReservations(staleAt),
		).resolves.toMatchObject({ failed: 1, scanned: 1 });
	});

	it("batch-reconciles settled events without per-event delivery", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:missed-queue",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_sweep" } },
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		const settled = repository.events.get(CHAT_EVENT_ID);

		if (!settled) {
			throw new Error("missing settled event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...settled,
			createdAt: new Date("2026-07-31T00:00:00.000Z"),
		});
		gateway.results.set("gen_sweep", generationInfo("gen_sweep", 0.05));

		const outcome = await service.recoverUnreconciledSettled(
			new Date("2026-08-01T00:00:00.000Z"),
		);

		expect(outcome).toEqual({
			failed: 0,
			pending: 0,
			reconciled: 1,
			scanned: 1,
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
	});

	it("terminalizes gateway-pending settled events from their durable settledAt budget", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:settled-pending-budget",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_pending_settled" } },
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		const settled = repository.events.get(CHAT_EVENT_ID);

		if (!settled) {
			throw new Error("missing pending settled event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...settled,
			createdAt: new Date("2026-07-31T00:00:00.000Z"),
			settledAt: new Date("2026-08-01T00:00:00.000Z"),
		});
		gateway.results.set(
			"gen_pending_settled",
			Object.assign(new Error("Usage event not found"), { statusCode: 404 }),
		);
		const cutoff = new Date("2026-08-02T00:00:00.000Z");

		await expect(
			service.recoverUnreconciledSettled(
				cutoff,
				100,
				new Date("2026-08-01T00:04:00.000Z"),
			),
		).resolves.toMatchObject({ failed: 0, pending: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("settled");

		await expect(
			service.recoverUnreconciledSettled(
				cutoff,
				100,
				new Date("2026-08-01T00:30:00.000Z"),
			),
		).resolves.toMatchObject({ failed: 1, pending: 0, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
	});
});

describe("MeteringService guards and reconciliation durability", () => {
	const ORG_SUBJECT: MeteringSubject = {
		actorUserId: USER_ID,
		organizationId: "org_1",
	};

	it("caps a settlement above the sanity ceiling instead of refusing the deliverable", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:ceiling",
		});

		// Chat ceiling = max(50_000, 100 * 25) = 50_000 cc ($20 provider cost).
		const ceiling = maxFinalCreditsCeiling("chat", 100);
		expect(ceiling).toBe(50_000);
		const settlement = {
			finalCredits: 60_001,
			pricing: "direct" as const,
			pricingSnapshot: { source: "test" },
		};

		// The provider work is done: the settlement lands, capped, with the
		// ceiling marker for admin review — never a refused settlement.
		await expect(
			service.settle(CHAT_EVENT_ID, settlement),
		).resolves.toMatchObject({
			finalCredits: 50_000,
			pricingSnapshot: {
				sanityCeiling: { attempted: 60_001, ceiling: 50_000 },
				source: "test",
			},
			status: "settled",
		});
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			allowOverdraft: true,
			amount: 50_000 - 100,
			idempotencyKey: `settle:${CHAT_EVENT_ID}`,
		});
		expect(credits.balances.get(USER_ID)).toBe(10_000 - 50_000);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("settled");

		// The caller's replay (its uncapped basis) stays idempotent.
		await expect(
			service.settle(CHAT_EVENT_ID, settlement),
		).resolves.toMatchObject({ finalCredits: 50_000, status: "settled" });
		expect(credits.consumeCalls).toHaveLength(2);
	});

	it("gives token operations a run-sized ceiling floor", () => {
		// Reviewer scenario: page_build reserves the flat 1000 cc floor; a long
		// 64-step build can exceed $10 of provider cost and must not be capped
		// at 25_000 cc. 250_000 cc = $100 at the $0.04 anchor.
		expect(maxFinalCreditsCeiling("page_build", 1_000)).toBe(250_000);
		expect(maxFinalCreditsCeiling("chat", 100)).toBe(50_000);
		expect(maxFinalCreditsCeiling("image", 350)).toBe(20_000);
		expect(maxFinalCreditsCeiling("video", 350)).toBe(100_000);
	});

	it("re-checks the member limit at settle and reconcile with the reserve-time exemption", async () => {
		const { credits, gateway, organizationLimits, repository, service } =
			setup();
		credits.setBalance("org_1", 10_000);
		vi.mocked(organizationLimits.resolveMemberLimit).mockImplementation(
			async (_orgId, _userId, exempt) => ({
				limitCredits: exempt ? null : 150,
				source: exempt ? "none" : "member",
			}),
		);
		vi.mocked(organizationLimits.sumMemberSpendThisMonth).mockResolvedValue(
			100,
		);

		await service.reserve(
			"chat",
			{ ...ORG_SUBJECT, actorIsLimitExempt: true },
			{
				credits: 100,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:exempt-owner",
			},
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.pricingSnapshot).toMatchObject(
			{ actorIsLimitExempt: true },
		);

		const settled = await service.settle(CHAT_EVENT_ID, {
			finalCredits: 200,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});

		// The exempt owner is not stamped as over-limit.
		expect(
			vi.mocked(organizationLimits.resolveMemberLimit).mock.calls.at(-1)?.[2],
		).toBe(true);
		expect(settled.pricingSnapshot).toMatchObject({ actorIsLimitExempt: true });
		expect(settled.pricingSnapshot).not.toHaveProperty("memberLimitBreach");

		// The exemption survives the settlement snapshot into reconciliation.
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_exempt" } },
			stepUsage: null,
		});
		gateway.results.set("gen_exempt", generationInfo("gen_exempt", 0.5));
		const { event } = await service.reconcile(CHAT_EVENT_ID);

		expect(event.finalCredits).toBeGreaterThan(200);
		expect(
			vi.mocked(organizationLimits.resolveMemberLimit).mock.calls.at(-1)?.[2],
		).toBe(true);
		expect(event.pricingSnapshot).not.toHaveProperty("memberLimitBreach");
	});

	it("prices a late completion from the gateway cost under the reservation anchor", async () => {
		const { credits, gateway, lifecycleRows, pricing, repository, service } =
			setup();
		credits.setNetConsumed(USER_ID, 349);
		pricing.usdMicrosPerCredit = 28_000;
		await service.reserve("image", USER_SUBJECT, {
			credits: 1_000,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:late-completion",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 4 },
		});
		// The anchor flips after admission; the hold keeps 28_000.
		pricing.usdMicrosPerCredit = 40_000;
		expect(repository.events.get(CHAT_EVENT_ID)?.pricingSnapshot).toMatchObject(
			{ usdMicrosPerCredit: 28_000 },
		);

		// Early ref (fixedUnits 0), the run crashes, the stranded sweep
		// reconciles at 0 cc while the gateway reports the exact cost.
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_late" } },
			stepUsage: { metering: { fixedUnits: 0 }, providerUsage: null },
		});
		gateway.results.set("gen_late", generationInfo("gen_late", 0.2));
		const reconciled = await service.reconcile(CHAT_EVENT_ID);
		expect(reconciled.event).toMatchObject({
			finalCredits: 0,
			reconciledCostUsdMicros: 200_000,
			status: "reconciled",
		});
		const balanceAfterReconcile = credits.balances.get(USER_ID);

		// The late completion checkpoint prices the 4 images from the exact
		// gateway cost at the reservation anchor — not 4 × the estimate at the
		// live 40_000 anchor (= 1_344 cc).
		await service.upgradeFixedGenerationUnits(CHAT_EVENT_ID, 4);
		const expected = usdMicrosToCentiCredits(200_000, 28_000);

		expect(expected).toBe(715);
		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			finalCredits: expected,
			pricingSnapshot: { lateFixedCompletion: { units: 4 }, units: 4 },
			status: "reconciled",
		});
		expect(credits.balances.get(USER_ID)).toBe(
			(balanceAfterReconcile ?? 0) - expected,
		);
		expect(lifecycleRows.has(`credits_25_used:${USER_ID}`)).toBe(true);
	});

	it("keeps the settle-time estimate when the gateway reports zero cost for delivered work", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:zero-cost",
			measuredTerms: { estimatedUnitUsdMicros: 134_400, units: 1 },
		});
		await service.settle(
			CHAT_EVENT_ID,
			measuredSettlement("image", 1, 134_400),
		);
		const settledBalance = credits.balances.get(USER_ID);
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_zero" } },
			stepUsage: { metering: { fixedUnits: 1 }, providerUsage: null },
		});
		gateway.results.set("gen_zero", generationInfo("gen_zero", 0));

		const outcome = await service.reconcile(CHAT_EVENT_ID);

		// No refund: the delivered image is not free; the event is flagged.
		expect(outcome).toMatchObject({
			adjustedCredits: 0,
			reconciledCostUsdMicros: 0,
		});
		expect(outcome.event).toMatchObject({
			finalCredits: usdMicrosToCentiCredits(134_400, 50_000),
			pricingSnapshot: { reviewFlags: ["gateway_zero_cost"] },
			status: "reconciled",
		});
		expect(credits.balances.get(USER_ID)).toBe(settledBalance);
		expect(
			credits.refundCalls.filter((call) =>
				call.idempotencyKey.startsWith("reconcile-refund:"),
			),
		).toHaveLength(0);
	});

	it("still charges nothing when a zero-cost gateway result matches a zero settlement", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:own-provider",
			measuredTerms: { estimatedUnitUsdMicros: 0, units: 1 },
		});
		// A known zero cost (render on the user's own provider subscription).
		await service.settle(CHAT_EVENT_ID, {
			...measuredSettlement("image", 1, 0),
			finalCredits: 0,
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_own" } },
			stepUsage: { metering: { fixedUnits: 1 }, providerUsage: null },
		});
		gateway.results.set("gen_own", generationInfo("gen_own", 0));

		const { event } = await service.reconcile(CHAT_EVENT_ID);

		expect(event.finalCredits).toBe(0);
		expect(event.pricingSnapshot).not.toHaveProperty("reviewFlags");
	});

	it("leaves a floor-settled measured event without refs unreconciled for admin review", async () => {
		const { repository, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:no-catalog-rate",
			measuredTerms: { estimatedUnitUsdMicros: null, units: 1 },
		});
		// The settlement a no-catalog-rate reserve produces: the registry floor,
		// flagged (see measuredOperationSettlement).
		await service.settle(CHAT_EVENT_ID, {
			costUsdMicros: null,
			finalCredits: 350,
			pricing: "direct",
			pricingSnapshot: {
				estimatedUnitUsdMicros: null,
				mode: "measured",
				operation: "image",
				outcome: "delivered",
				reviewFlags: ["no_catalog_rate"],
				source: "measured_local",
				unit: "image",
				units: 1,
				usdMicrosPerCredit: 50_000,
			},
		});
		const settled = repository.events.get(CHAT_EVENT_ID);
		if (!settled) {
			throw new Error("missing settled event");
		}
		repository.events.set(CHAT_EVENT_ID, {
			...settled,
			createdAt: new Date("2026-07-31T00:00:00.000Z"),
		});

		// Not finalized as a flat 3.5-credit charge: parked in reconcile_failed,
		// where admin views show it for repair.
		await expect(
			service.recoverSettledWithoutRefs(new Date("2026-08-02T00:00:00.000Z")),
		).resolves.toMatchObject({ failed: 1, pending: 0, reconciled: 0 });
		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			finalCredits: 350,
			pricingSnapshot: { reviewFlags: ["no_catalog_rate"] },
			status: "reconcile_failed",
		});
	});

	it("reconciles a legacy flat-price lead scrape settled by the per-lead code", async () => {
		const { credits, service } = setup();
		await service.reserve("lead_scrape", USER_SUBJECT, {
			credits: 500,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "lead-scrape:legacy",
		});
		// The settlement the new code writes for a hold admitted under the
		// retired flat price: unit 'operation', not the registry's 'lead'.
		await service.settle(CHAT_EVENT_ID, {
			costUsdMicros: 3_000,
			finalCredits: 500,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerOperation: 500,
				creditsPerUnit: 500,
				mode: "fixed",
				operation: "lead_scrape",
				source: "operation_registry",
				unit: "operation",
				units: 1,
			},
			rawUsage: { provider: "serper", resultCount: 120, serperPages: 3 },
		});
		await service.captureProviderCallEvidence(CHAT_EVENT_ID, {
			chargedUsdMicros: 3_000,
			costSource: "serper_contract_env",
			costStatus: "contract_rate",
			customerBillable: false,
			idempotencyKey: "serper:legacy",
			rateUsdMicrosPerUnit: 1_000,
			transport: "serper",
			unitKind: "search_page",
			units: 3,
		});

		const outcome = await service.reconcile(CHAT_EVENT_ID);

		expect(outcome).toMatchObject({
			adjustedCredits: 0,
			reconciledCostUsdMicros: 3_000,
		});
		expect(outcome.event).toMatchObject({
			finalCredits: 500,
			status: "reconciled",
		});
		expect(credits.balances.get(USER_ID)).toBe(10_000 - 500);
	});

	it("reports the execution lease heartbeat as renewed, lost, or error", async () => {
		const { repository, service } = setup();
		const heartbeat = vi.fn<() => Promise<boolean>>();
		Object.assign(repository, { heartbeatExecutionLease: heartbeat });

		heartbeat.mockResolvedValueOnce(true);
		await expect(
			service.heartbeatExecutionLease(CHAT_EVENT_ID, "token", 60_000),
		).resolves.toBe("renewed");

		// A confirmed CAS miss: the row is not reserved under this token.
		heartbeat.mockResolvedValueOnce(false);
		await expect(
			service.heartbeatExecutionLease(CHAT_EVENT_ID, "token", 60_000),
		).resolves.toBe("lost");

		// A transport failure proves nothing about the lease.
		heartbeat.mockRejectedValueOnce(new Error("pool timeout"));
		await expect(
			service.heartbeatExecutionLease(CHAT_EVENT_ID, "token", 60_000),
		).resolves.toBe("error");
	});

	it("settles a member-limit breach softly and blocks the next reserve", async () => {
		const { credits, organizationLimits, repository, service } = setup();
		credits.setBalance("org_1", 10_000);
		vi.mocked(organizationLimits.resolveMemberLimit).mockResolvedValue({
			limitCredits: 150,
			source: "member",
		});
		vi.mocked(organizationLimits.sumMemberSpendThisMonth)
			.mockResolvedValueOnce(0)
			.mockResolvedValue(100);

		await service.reserve("chat", ORG_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:member-limit",
		});
		const settled = await service.settle(CHAT_EVENT_ID, {
			finalCredits: 200,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});

		// The provider cost is spent: the overage settles, with the marker.
		expect(settled).toMatchObject({
			finalCredits: 200,
			pricingSnapshot: {
				memberLimitBreach: {
					deltaCredits: 100,
					limitCredits: 150,
					spentCredits: 100,
				},
				source: "test",
			},
			status: "settled",
		});
		expect(credits.balances.get("org_1")).toBe(10_000 - 200);

		// A replay with the marker-less caller snapshot still validates.
		await expect(
			service.settle(CHAT_EVENT_ID, {
				finalCredits: 200,
				pricing: "direct",
				pricingSnapshot: { source: "test" },
			}),
		).resolves.toMatchObject({ status: "settled" });

		// The hard stop lands on the next reserve (100 spent + 100 > 150).
		await expect(
			service.reserve("chat", ORG_SUBJECT, {
				credits: 100,
				eventId: CHILD_EVENT_ID,
				idempotencyKey: "chat:member-limit-next",
			}),
		).rejects.toBeInstanceOf(MemberCreditLimitError);
		expect(repository.events.has(CHILD_EVENT_ID)).toBe(false);
	});

	it("finalizes a settled event without refs and keeps a reserved one pending", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:no-refs",
		});

		await expect(service.reconcile(CHAT_EVENT_ID)).rejects.toBeInstanceOf(
			GatewayUsagePendingError,
		);
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reserved");

		await service.settle(CHAT_EVENT_ID, {
			costUsdMicros: 4_000,
			finalCredits: 80,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		const balanceAfterSettle = credits.balances.get(USER_ID);

		const outcome = await service.reconcile(CHAT_EVENT_ID);

		expect(outcome).toMatchObject({
			adjustedCredits: 0,
			reconciledCostUsdMicros: 4_000,
		});
		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			finalCredits: 80,
			pricingSnapshot: {
				costUsdMicros: 4_000,
				reconciliation: { source: "no_generation_refs" },
			},
			reconciledCostUsdMicros: 4_000,
			status: "reconciled",
		});
		expect(credits.balances.get(USER_ID)).toBe(balanceAfterSettle);
		// Idempotent: a second reconcile is a no-op on the reconciled row.
		await expect(service.reconcile(CHAT_EVENT_ID)).resolves.toMatchObject({
			adjustedCredits: 0,
		});
	});

	it("sweeps settled events without refs only past the age gate", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:no-refs-sweep",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});

		await expect(
			service.recoverSettledWithoutRefs(new Date(Date.now() - 60_000)),
		).resolves.toEqual({ failed: 0, pending: 0, reconciled: 0, scanned: 0 });
		await expect(
			service.recoverSettledWithoutRefs(new Date(Date.now() + 60_000)),
		).resolves.toEqual({ failed: 0, pending: 0, reconciled: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
	});

	it("schedules reconcile_failed retries with 5m/10m/20m backoff and dead-letters at the cap", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"));

		try {
			const { credits, service } = setup();
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:backoff",
			});
			const delays: number[] = [];

			for (let attempt = 1; attempt < RECONCILE_DEAD_LETTER_CAP; attempt += 1) {
				const event =
					await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

				expect(event.status).toBe("reconcile_failed");
				expect(event.reconcileAttempts).toBe(attempt);
				// Still retryable: the reserve stays an open hold (final null).
				expect(event.finalCredits).toBeNull();
				delays.push(
					(event.nextReconcileAttemptAt?.getTime() ?? Number.NaN) - Date.now(),
				);
			}

			expect(delays.slice(0, 4)).toEqual([
				5 * 60_000,
				10 * 60_000,
				20 * 60_000,
				40 * 60_000,
			]);
			// Capped at 6 hours: 5m * 2^8 = 21h20m would exceed it.
			expect(delays.at(-1)).toBe(6 * 60 * 60_000);

			const deadLettered =
				await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

			// Dead-lettered: nobody retries, so the hold must resolve — but with
			// no local evidence (no refs, no receipts) the run produced nothing we
			// can price, so the whole reserve refunds instead of becoming a
			// silent full charge. The row stays reconcile_failed for admin review.
			expect(deadLettered).toMatchObject({
				finalCredits: 0,
				nextReconcileAttemptAt: null,
				reconcileAttempts: RECONCILE_DEAD_LETTER_CAP,
				status: "reconcile_failed",
			});
			expect(credits.refundCalls).toEqual([
				expect.objectContaining({
					amount: 100,
					consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
					idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
				}),
			]);
			expect(credits.balances.get(USER_ID)).toBe(10_000);
		} finally {
			vi.useRealTimers();
		}
	});

	it("charges a dead-lettered never-settled hold its local unit evidence, not the reserve", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 350,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:dead-letter-evidence",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_dead_units" } },
			stepUsage: { metering: { fixedUnits: 1 }, providerUsage: null },
		});
		const reserved = repository.events.get(CHAT_EVENT_ID);

		if (!reserved) {
			throw new Error("missing dead-letter evidence event");
		}

		// One attempt away from the cap, priced under a durable fixed snapshot:
		// the delivered unit is locally provable at 100 cc.
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: legacyFixedReservationSnapshot("image", 100),
			reconcileAttempts: RECONCILE_DEAD_LETTER_CAP - 1,
		});

		const deadLettered =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		expect(deadLettered).toMatchObject({
			finalCredits: 100,
			nextReconcileAttemptAt: null,
			reconcileAttempts: RECONCILE_DEAD_LETTER_CAP,
			status: "reconcile_failed",
		});
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 250,
				consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(9_900);
	});

	it("prices a dead-lettered never-settled hold from settled provider receipts", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:dead-letter-receipts",
		});
		await service.captureProviderCallEvidence(CHAT_EVENT_ID, {
			chargedUsdMicros: 25_000,
			costSource: "serper_contract_env",
			costStatus: "contract_rate",
			customerBillable: true,
			idempotencyKey: "serper:dead-letter",
			rateUsdMicrosPerUnit: 25_000,
			transport: "serper",
			unitKind: "search_page",
			units: 1,
		});
		const reserved = repository.events.get(CHAT_EVENT_ID);

		if (!reserved) {
			throw new Error("missing dead-letter receipt event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			reconcileAttempts: RECONCILE_DEAD_LETTER_CAP - 1,
		});

		const deadLettered =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		// 25,000 usd-micros at 50,000 per credit = 50 cc; the other 50 cc of the
		// hold refund.
		expect(deadLettered).toMatchObject({
			finalCredits: 50,
			nextReconcileAttemptAt: null,
			status: "reconcile_failed",
		});
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 50,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(9_950);
	});

	it("retries only due reconcile_failed rows and skips dead-lettered ones", async () => {
		const { gateway, repository, service } = setup();
		const now = new Date("2026-08-01T12:00:00.000Z");
		const seedFailed = async (
			eventId: string,
			generationId: string,
			nextReconcileAttemptAt: Date | null,
		) => {
			await service.reserve("chat", USER_SUBJECT, {
				credits: 100,
				eventId,
				idempotencyKey: `chat:retry:${eventId}`,
			});
			await service.captureGeneration(eventId, {
				providerMetadata: { gateway: { generationId } },
			});
			await service.settle(eventId, {
				finalCredits: 100,
				pricing: "direct",
				pricingSnapshot: { source: "test" },
			});
			const failed = await service.terminalizeReconciliationFailure(eventId);
			repository.events.set(eventId, { ...failed, nextReconcileAttemptAt });
			gateway.results.set(generationId, generationInfo(generationId, 0.05));
		};
		const DEAD_EVENT_ID = "33333333-3333-4333-8333-333333333333";

		await seedFailed(CHAT_EVENT_ID, "gen_due", new Date(now.getTime() - 1));
		await seedFailed(
			CHILD_EVENT_ID,
			"gen_future",
			new Date(now.getTime() + 60_000),
		);
		await seedFailed(DEAD_EVENT_ID, "gen_dead", null);

		await expect(service.retryFailedReconciliations(now)).resolves.toEqual({
			failed: 0,
			pending: 0,
			reconciled: 1,
			scanned: 1,
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
		expect(repository.events.get(CHILD_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
		expect(repository.events.get(DEAD_EVENT_ID)?.status).toBe(
			"reconcile_failed",
		);
	});

	it("advances the backoff when a retried reconciliation fails again", async () => {
		const { gateway, repository, service } = setup();
		const now = new Date("2026-08-01T12:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:retry-again",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_again" } },
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		const failed =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);
		repository.events.set(CHAT_EVENT_ID, {
			...failed,
			nextReconcileAttemptAt: new Date(now.getTime() - 1),
		});
		gateway.results.set(
			"gen_again",
			Object.assign(new Error("bad request"), { statusCode: 400 }),
		);

		await expect(service.retryFailedReconciliations(now)).resolves.toEqual({
			failed: 1,
			pending: 0,
			reconciled: 0,
			scanned: 1,
		});
		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			reconcileAttempts: 2,
			status: "reconcile_failed",
		});
		expect(
			repository.events.get(CHAT_EVENT_ID)?.nextReconcileAttemptAt,
		).not.toBeNull();
	});

	it("clears the execution lease when an event settles or refunds", async () => {
		const { repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 100,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:lease-settle",
		});
		const reserved = repository.events.get(CHAT_EVENT_ID);

		if (!reserved) {
			throw new Error("missing reserved event");
		}

		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			executionLeaseExpiresAt: new Date(Date.now() + 60_000),
			executionLeaseToken: randomUUID(),
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 100,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});

		expect(repository.events.get(CHAT_EVENT_ID)).toMatchObject({
			executionLeaseExpiresAt: null,
			executionLeaseToken: null,
			status: "settled",
		});
	});
});

function makeEvent(input: InsertAiUsageEvent): AiUsageEvent {
	return {
		attemptRef: input.attemptRef ?? null,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: input.chatId ?? null,
		createdAt: new Date(),
		estimatedCostUsdMicros: input.estimatedCostUsdMicros ?? null,
		finalCredits: null,
		id: String(input.id ?? randomUUID()),
		idempotencyKey: input.idempotencyKey,
		inputTokens: null,
		messageId: input.messageId ?? null,
		model: input.model ?? null,
		operation: input.operation,
		organizationId: input.organizationId ?? null,
		outputTokens: null,
		parentEventId: input.parentEventId ?? null,
		pricingSnapshot: input.pricingSnapshot ?? null,
		provider: input.provider ?? null,
		rawUsage: null,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: input.reservedCredits,
		settledAt: null,
		status: input.status ?? "reserved",
		userId: input.userId,
		executionLeaseToken: null,
		executionLeaseExpiresAt: null,
		reconcileAttempts: 0,
		nextReconcileAttemptAt: null,
	};
}

function generationInfo(id: string, totalCost: number) {
	return {
		billableWebSearchCalls: 0,
		cacheCreationTokens: 3,
		cachedTokens: 7,
		completionTokens: 40,
		createdAt: "2026-08-01T00:00:00.000Z",
		finishReason: "stop",
		generationTime: 100,
		id,
		isByok: false,
		latency: 10,
		model: "openai/test",
		promptTokens: 100,
		providerName: "openai",
		reasoningTokens: 0,
		streamed: true,
		totalCost,
		upstreamInferenceCost: totalCost,
		usage: totalCost,
	};
}
