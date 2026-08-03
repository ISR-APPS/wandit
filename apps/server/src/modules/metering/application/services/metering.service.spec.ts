import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type {
	CreditOwner,
	MeteringSubject,
} from "../../../credits/domain/credit-owner";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { OrganizationLimitsRepository } from "../../../workspaces/infrastructure/persistence/organization-limits.repository";
import {
	type AiUsageEvent,
	type AiUsageGenerationRef,
	bundledReservationPendingAttemptRef,
	bundledUnmeteredStepUsage,
	GatewayUsagePendingError,
	isBundledUnmeteredStepUsage,
	type MeteringGateway,
	MeteringStateConflictError,
} from "../../domain/metering";
import {
	normalizeTokenUsage,
	type TokenUsageQuote,
	usdMicrosToCredits,
} from "../../domain/model-pricing";
import type {
	AiUsageEventPatch,
	InsertAiUsageEvent,
	InsertAiUsageGenerationRef,
	MeteringRepository,
	MeteringTransaction,
} from "../../infrastructure/persistence/metering.repository";
import { MeteringService } from "./metering.service";
import type { ModelPricingService } from "./model-pricing.service";

const USER_ID = "user_1";
const USER_SUBJECT: MeteringSubject = { actorUserId: USER_ID };
const CHAT_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CHILD_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_PENDING_ATTEMPT_REF =
	bundledReservationPendingAttemptRef("project:project-1");

class InMemoryMeteringRepository {
	readonly events = new Map<string, AiUsageEvent>();
	readonly refs = new Map<string, AiUsageGenerationRef>();
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

	async consume(
		owner: CreditOwner,
		amount: number,
		options: {
			actorUserId?: string;
			allowOverdraft?: boolean;
			idempotencyKey?: string;
			planHold?: "active" | "inactive";
		},
		transaction?: unknown,
	): Promise<[]> {
		const userId = ownerBalanceKey(owner);
		const idempotencyKey = options.idempotencyKey ?? "";
		const allowOverdraft = options.allowOverdraft === true;
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

		if (!allowOverdraft && balance < amount) {
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
		credits: 2,
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
			usdMicrosPerCredit: 50_000,
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
			credits: usdMicrosToCredits(this.quote.costUsdMicros, usdMicrosPerCredit),
			pricingSnapshot: {
				...this.quote.pricingSnapshot,
				usdMicrosPerCredit,
			},
			usage: normalizeTokenUsage(usage),
		};
	}
}

class FakeMeteringGateway implements MeteringGateway {
	readonly results = new Map<
		string,
		Awaited<ReturnType<MeteringGateway["getGenerationInfo"]>> | Error
	>();

	async getGenerationInfo({ id }: { id: string }) {
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

function setup(balance = 100) {
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
	credits.setBalance(USER_ID, balance);
	const service = new MeteringService(
		repository as unknown as MeteringRepository,
		credits as unknown as CreditsService,
		pricing as unknown as ModelPricingService,
		gateway,
		organizationLimits,
	);

	return { credits, gateway, organizationLimits, pricing, repository, service };
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
		const { credits, repository, service } = setup(2);

		await expect(
			service.reserve("chat", USER_SUBJECT, {
				credits: 3,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:message_1",
			}),
		).rejects.toMatchObject({
			availableCredits: 2,
			requiredCredits: 3,
			status: 402,
		});
		expect(repository.events).toHaveLength(0);
		expect(credits.balances.get(USER_ID)).toBe(2);
	});

	it("serializes concurrent reserves so only the affordable operation wins", async () => {
		const { credits, repository, service } = setup(1);
		const results = await Promise.allSettled([
			service.reserve("chat", USER_SUBJECT, {
				credits: 1,
				eventId: CHAT_EVENT_ID,
				idempotencyKey: "chat:one",
			}),
			service.reserve("chat", USER_SUBJECT, {
				credits: 1,
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
			credits: 2,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		};
		const first = await service.reserveWithReplay("chat", USER_SUBJECT, estimate);
		const replay = await service.reserveWithReplay("chat", USER_SUBJECT, estimate);

		expect(first).toMatchObject({ replay: "none", replayed: false });
		expect(replay).toEqual({
			event: first.event,
			replay: "reserved",
			replayed: true,
		});
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.consumeCalls[0]).toMatchObject({
			allowOverdraft: false,
			amount: 2,
			idempotencyKey: `reserve:${CHAT_EVENT_ID}`,
		});
		await expect(
			service.reserve("chat", USER_SUBJECT, { ...estimate, credits: 3 }),
		).rejects.toThrow("reserve idempotency replay conflict");
	});

	it("replays an org reserve for a different acting member of the same pool", async () => {
		const { credits, service } = setup();
		credits.setBalance("org_1", 100);
		const estimate = {
			credits: 2,
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
		).rejects.toThrow("reserve idempotency replay conflict");
	});

	it("atomically admits only one bundled-reservation claim across concurrent instances", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 1,
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
		const rejected = results.filter((result) => result.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]).toMatchObject({
			reason: expect.any(MeteringStateConflictError),
		});
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

	it("preserves title-complete state when completion wins before the stream claim", async () => {
		const { service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 1,
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
			credits: 1,
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
			finalCredits: 1,
			settledAt: new Date(),
			status: "settled",
		});

		await expect(service.claimBundledReservation(input)).rejects.toBeInstanceOf(
			MeteringStateConflictError,
		);
		await expect(
			service.claimBundledReservation({
				...input,
				claimAttemptRef: bundledReservationPendingAttemptRef(
					"project-stream:project-1:request-2",
				),
			}),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
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
			credits: 2,
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
				finalCredits: 1,
				pricingSnapshot: {
					gatewayReconciliation: {
						customerBillableCostUsdMicros: 50_000,
						generations: expect.arrayContaining([
							expect.objectContaining({
								costUsdMicros: 500_000,
								customerBilling: "bundled_unmetered",
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

	it("keeps the one-credit creation charge when only bundled title usage exists", async () => {
		const { credits, gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			attemptRef: PROJECT_PENDING_ATTEMPT_REF,
			chatId: "chat-1",
			credits: 1,
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
		expect(credits.balances.get(USER_ID)).toBe(99);
	});

	it.each([
		"settled",
		"reconciled",
	] as const)("reports an explicit %s replay while the provider-facing reserve fails closed", async (status) => {
		const { credits, repository, service } = setup();
		const estimate = {
			credits: 2,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:terminal-replay",
		};
		const first = await service.reserveWithReplay("chat", USER_SUBJECT, estimate);
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
			credits: 2,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:failed-replay",
		};
		const first = await service.reserveWithReplay("chat", USER_SUBJECT, estimate);
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
				credits: 4,
				idempotencyKey: "image:too-cheap",
			}),
		).rejects.toThrow("at least 5 credits");

		const parent = await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:parent",
		});
		await expect(
			service.reserve("image", USER_SUBJECT, {
				credits: 5,
				idempotencyKey: "image:child",
				parentEventId: parent.id,
			}),
		).resolves.toMatchObject({ operation: "image", parentEventId: parent.id });
		await expect(
			service.reserve("transcription", USER_SUBJECT, {
				credits: 1,
				idempotencyKey: "transcription:child",
				parentEventId: parent.id,
			}),
		).rejects.toThrow("cannot be nested under chat");
	});

	it("settles an overage to debt once with settle:{eventId}", async () => {
		const { credits, service } = setup(10);
		await service.reserve("chat", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		const settlement = {
			finalCredits: 13,
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
			amount: 3,
			idempotencyKey: `settle:${CHAT_EVENT_ID}`,
		});
		expect(credits.balances.get(USER_ID)).toBe(-3);
	});

	it("partially refunds a reserve once with settle-refund:{eventId}", async () => {
		const { credits, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		const settlement = {
			finalCredits: 6,
			pricing: "direct" as const,
			pricingSnapshot: { mode: "fixed" },
		};
		await service.settle(CHAT_EVENT_ID, settlement);
		await service.settle(CHAT_EVENT_ID, settlement);

		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 4,
				consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(94);
	});

	it("never refunds a reserved event after a generation ref is durable", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 5,
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
		expect(credits.balances.get(USER_ID)).toBe(95);
	});

	it("settles a direct parent and child atomically in parent-first lock order", async () => {
		const { credits, repository, service } = setup();
		await service.reserve("connector", USER_SUBJECT, {
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "connector:attempt_1",
		});
		await service.reserve("image", USER_SUBJECT, {
			credits: 5,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "image:attempt_1",
			parentEventId: CHAT_EVENT_ID,
		});
		const parent = {
			eventId: CHAT_EVENT_ID,
			settlement: {
				finalCredits: 5,
				pricing: "direct" as const,
				pricingSnapshot: { mode: "fixed", operation: "connector" },
			},
		};
		const child = {
			eventId: CHILD_EVENT_ID,
			settlement: {
				finalCredits: 5,
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
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "connector:completion-atomic",
		});
		await service.reserve("image", USER_SUBJECT, {
			credits: 5,
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
				finalCredits: 5,
				pricing: "direct" as const,
				pricingSnapshot: {
					creditsPerUnit: 5,
					mode: "fixed",
					operation: "connector",
					units: 1,
				},
			},
		};
		const child = {
			eventId: CHILD_EVENT_ID,
			settlement: {
				finalCredits: 5,
				pricing: "direct" as const,
				pricingSnapshot: {
					creditsPerUnit: 5,
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
			child: { finalCredits: 5, status: "settled" },
			parent: { finalCredits: 5, status: "settled" },
		});
		expect([...repository.refs.values()][0]?.stepUsage).toMatchObject({
			metering: { fixedUnits: 1 },
		});
	});

	it("persists normalized token details from ModelPricingService", async () => {
		const { service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
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
			finalCredits: 2,
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
			credits: 2,
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
			finalCredits: 2,
			pricingSnapshot: { usdMicrosPerCredit: 50_000 },
			status: "settled",
		});
	});

	it("replays a settled token request without consulting volatile model pricing", async () => {
		const { credits, pricing, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
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
			credits: 10,
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
			credits: 2,
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
			credits: 10,
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
			credits: 1,
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
			credits: 1,
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
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_1" } },
		});

		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 1,
			pricing: "direct",
			pricingSnapshot: { source: "test" },
		});
		gateway.results.set("gen_1", generationInfo("gen_1", 0.05));

		await expect(
			service.recoverUnreconciledSettled(new Date("2100-01-01")),
		).resolves.toMatchObject({ reconciled: 1, scanned: 1 });
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("reconciled");
	});

	it("keeps a late capture batch-selectable without any per-event handoff", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 1,
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
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 3,
			pricing: "direct",
			pricingSnapshot: {
				mode: "token",
				quotedCredits: 3,
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
			adjustedCredits: 3,
			reconciledCostUsdMicros: 250_001,
		});
		expect(result.event).toMatchObject({
			cacheReadTokens: 14,
			cacheWriteTokens: 6,
			finalCredits: 6,
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
			quotedCredits: 3,
			source: "estimate",
			settlementPricingSnapshot: {
				costUsdMicros: null,
				mode: "token",
				quotedCredits: 3,
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
			amount: 3,
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
			credits: 1,
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
		expect(result.event.finalCredits).toBe(2);
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
			credits: 1,
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
		expect(result.event.finalCredits).toBe(6);
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
			credits: 1,
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
			credits: 1,
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

		expect(result.event.finalCredits).toBe(2);
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
			credits: 1,
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

		expect(result.event.finalCredits).toBe(2);
		expect(result.adjustedCredits).toBe(1);
		expect(replay.event).toEqual(result.event);
		expect(replay.adjustedCredits).toBe(0);
		expect(credits.consumeCalls.at(-1)).toMatchObject({
			amount: 1,
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
			credits: 14,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:reserved-registry-snapshot",
		});
		repository.events.set(event.id, {
			...event,
			pricingSnapshot: {
				...(event.pricingSnapshot as Record<string, unknown>),
				creditsPerUnit: 7,
			},
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

		expect(result.event.finalCredits).toBe(14);
		expect(result.event.pricingSnapshot).toMatchObject({
			creditsPerUnit: 7,
			reservationPricingSnapshot: { creditsPerUnit: 7 },
			units: 2,
		});
		await expect(
			service.settle(CHAT_EVENT_ID, {
				finalCredits: 14,
				pricing: "direct",
				pricingSnapshot: {
					creditsPerUnit: 7,
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
			credits: 4,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:reserved-registry-snapshot",
		});
		repository.events.set(event.id, {
			...event,
			pricingSnapshot: {
				...(event.pricingSnapshot as Record<string, unknown>),
				creditsPerMinute: 2,
			},
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

		expect(result.event.finalCredits).toBe(4);
		expect(result.event.pricingSnapshot).toMatchObject({
			creditsPerMinute: 2,
			durationSeconds: 90,
			reservationPricingSnapshot: { creditsPerMinute: 2 },
		});
	});

	it("reconstructs fixed registry pricing when reconciling a reserved event", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:attempt_1",
		});
		for (const id of ["gen_image_1", "gen_image_2"]) {
			await service.captureGeneration(CHAT_EVENT_ID, {
				providerMetadata: { gateway: { generationId: id } },
				stepUsage: { deliveredImages: 1 },
			});
			gateway.results.set(id, generationInfo(id, 0.6));
		}

		const result = await service.reconcile(CHAT_EVENT_ID);
		const recoveredCompletion = {
			finalCredits: 10,
			pricing: "direct" as const,
			pricingSnapshot: {
				creditsPerUnit: 5,
				mode: "fixed",
				operation: "image",
				source: "operation_registry",
				unit: "image",
				units: 2,
			},
		};

		expect(result).toMatchObject({
			adjustedCredits: 0,
			reconciledCostUsdMicros: 1_200_000,
		});
		expect(result.event).toMatchObject({
			finalCredits: 10,
			operation: "image",
			pricingSnapshot: {
				creditsPerUnit: 5,
				mode: "fixed",
				operation: "image",
				source: "operation_registry_recovery",
				unit: "image",
				units: 2,
			},
			status: "reconciled",
		});
		expect(result.event.rawUsage).toMatchObject({
			generationRefs: [
				{
					gatewayGenerationId: "gen_image_1",
					stepUsage: { deliveredImages: 1 },
				},
				{
					gatewayGenerationId: "gen_image_2",
					stepUsage: { deliveredImages: 1 },
				},
			],
		});
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.refundCalls).toHaveLength(0);
		await expect(
			service.settle(CHAT_EVENT_ID, recoveredCompletion),
		).resolves.toEqual(result.event);
		await expect(
			service.settle(CHAT_EVENT_ID, {
				...recoveredCompletion,
				finalCredits: 5,
				pricingSnapshot: {
					...recoveredCompletion.pricingSnapshot,
					units: 1,
				},
			}),
		).rejects.toThrow("settle replay conflict");
		await expect(
			service.settle(CHAT_EVENT_ID, {
				...recoveredCompletion,
				rawUsage: { deliveredImages: 2 },
			}),
		).rejects.toThrow("settle replay conflict");
	});

	it("allows a zero-unit direct settlement to refund an empty fixed result", async () => {
		const { credits, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:empty-result",
		});

		const settled = await service.settle(CHAT_EVENT_ID, {
			finalCredits: 0,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerUnit: 5,
				mode: "fixed",
				operation: "image",
				units: 0,
			},
		});

		expect(settled).toMatchObject({ finalCredits: 0, status: "settled" });
		expect(credits.refundCalls.at(-1)).toMatchObject({
			amount: 5,
			idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
		});
	});

	it("atomically settles fixed recovery from the larger stored/provider unit count", async () => {
		const { credits, repository, service } = setup();
		const reserved = await service.reserve("image", USER_SUBJECT, {
			credits: 8,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:fixed-evidence-recovery",
		});
		repository.events.set(reserved.id, {
			...reserved,
			pricingSnapshot: {
				...(reserved.pricingSnapshot as Record<string, unknown>),
				creditsPerUnit: 4,
			},
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_fixed_evidence" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});

		const settled = await service.settleFixedFromEvidence(CHAT_EVENT_ID, 1);
		const replay = await service.settleFixedFromEvidence(CHAT_EVENT_ID, 1);

		expect(settled).toMatchObject({
			finalCredits: 8,
			pricingSnapshot: {
				creditsPerUnit: 4,
				operation: "image",
				units: 2,
			},
			status: "settled",
		});
		expect(replay).toEqual(settled);
		expect(credits.consumeCalls).toHaveLength(1);
		expect(credits.refundCalls).toHaveLength(0);
	});

	it("uses the stored fixed prefix when it exceeds provider evidence", async () => {
		const { service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 15,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:stored-prefix-recovery",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_stored_prefix" } },
			stepUsage: { metering: { fixedUnits: 2 } },
		});

		await expect(
			service.settleFixedFromEvidence(CHAT_EVENT_ID, 3),
		).resolves.toMatchObject({
			finalCredits: 15,
			pricingSnapshot: { creditsPerUnit: 5, units: 3 },
			status: "settled",
		});
	});

	it("financially finalizes an unpriced reconcile-failed fixed event without reopening reconciliation", async () => {
		const { credits, repository, service } = setup();
		const reserved = await service.reserve("image", USER_SUBJECT, {
			credits: 16,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:reconcile-failed-fixed-recovery",
		});
		repository.events.set(CHAT_EVENT_ID, {
			...reserved,
			pricingSnapshot: {
				...(reserved.pricingSnapshot as Record<string, unknown>),
				creditsPerUnit: 4,
			},
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: {
				gateway: { generationId: "gen_reconcile_failed_fixed" },
			},
			stepUsage: { metering: { fixedUnits: 2 } },
		});
		const terminal =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		const settled = await service.settleFixedFromEvidence(CHAT_EVENT_ID, 1);
		const replay = await service.settleFixedFromEvidence(CHAT_EVENT_ID, 3);

		expect(settled).toMatchObject({
			finalCredits: 8,
			pricingSnapshot: {
				creditsPerUnit: 4,
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
				amount: 8,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		]);
	});

	it("reconciles a crash-stranded four-image reserve from one durable unit ref", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 20,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:partial-crash",
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
			finalCredits: 5,
			pricingSnapshot: {
				creditsPerUnit: 5,
				mode: "fixed",
				operation: "image",
				units: 1,
			},
			status: "reconciled",
		});
		expect(credits.refundCalls.at(-1)).toMatchObject({
			amount: 15,
			idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
		});
	});

	it("accepts zero-unit settlement replay when reconciliation wins the race", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:empty-race",
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

		const reconciled = await service.reconcile(CHAT_EVENT_ID);
		expect(reconciled.event).toMatchObject({
			finalCredits: 0,
			status: "reconciled",
		});
		await expect(
			service.settle(CHAT_EVENT_ID, {
				finalCredits: 0,
				pricing: "direct",
				pricingSnapshot: {
					creditsPerUnit: 5,
					mode: "fixed",
					operation: "image",
					source: "operation_registry",
					unit: "image",
					units: 0,
				},
			}),
		).resolves.toEqual(reconciled.event);
	});

	it("preserves fixed settlement pricing and raw usage during reconciliation", async () => {
		const { gateway, service } = setup();
		await service.reserve("image", USER_SUBJECT, {
			credits: 10,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "image:settled",
		});
		const settlement = {
			finalCredits: 10,
			pricing: "direct" as const,
			pricingSnapshot: {
				creditsPerUnit: 5,
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
			creditsPerUnit: 5,
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

	it("reconstructs per-minute pricing and preserves captured duration evidence", async () => {
		const { gateway, service } = setup();
		await service.reserve("transcription", USER_SUBJECT, {
			credits: 2,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:operation_1",
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
			finalCredits: 1,
			pricingSnapshot: {
				authoritativeDurationSeconds: 60,
				creditsPerMinute: 1,
				durationCapped: false,
				durationSeconds: 60,
				finalCredits: 1,
				maxDurationSeconds: 300,
				minimumCredits: 1,
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
		const { gateway, service } = setup();
		await service.reserve("transcription", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:local-duration",
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

		expect(result).toMatchObject({ adjustedCredits: 2 });
		expect(result.event).toMatchObject({
			finalCredits: 3,
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
		const { credits, gateway, service } = setup();
		await service.reserve("transcription", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:provider-over-cap",
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

		expect(result).toMatchObject({ adjustedCredits: 4 });
		expect(result.event).toMatchObject({
			finalCredits: 5,
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
			amount: 4,
			idempotencyKey: `reconcile:${CHAT_EVENT_ID}`,
		});
	});

	it("fails closed when a reserved transcription lacks positive duration evidence", async () => {
		const { credits, gateway, repository, service } = setup();
		await service.reserve("transcription", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:missing-duration",
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

	it("retains a settled transcription debit when reconciliation duration is invalid", async () => {
		const { gateway, service } = setup();
		await service.reserve("transcription", USER_SUBJECT, {
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "transcription:settled-duration",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 2,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerMinute: 1,
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

		expect(event).toMatchObject({ finalCredits: 2, status: "reconciled" });
	});

	it("reconciliation refunds settled overage before the original reserve", async () => {
		const { credits, gateway, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 5,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:message_1",
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 8,
			pricing: "direct",
			pricingSnapshot: { source: "estimate" },
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_lower" } },
		});
		gateway.results.set("gen_lower", generationInfo("gen_lower", 0.1));

		const result = await service.reconcile(CHAT_EVENT_ID);

		expect(result.event.finalCredits).toBe(2);
		expect(credits.refundCalls).toEqual([
			expect.objectContaining({
				amount: 3,
				consumeIdempotencyKey: `settle:${CHAT_EVENT_ID}`,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:settle`,
			}),
			expect.objectContaining({
				amount: 3,
				consumeIdempotencyKey: `reserve:${CHAT_EVENT_ID}`,
				idempotencyKey: `reconcile-refund:${CHAT_EVENT_ID}:reserve`,
			}),
		]);
		expect(credits.balances.get(USER_ID)).toBe(98);
	});

	it("retries gateway usage-not-found without marking reconciliation failed", async () => {
		const { gateway, repository, service } = setup();
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
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
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:terminal-reconcile",
		});

		const terminal =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);
		const replay =
			await service.terminalizeReconciliationFailure(CHAT_EVENT_ID);

		expect(terminal.status).toBe("reconcile_failed");
		expect(replay).toEqual(terminal);
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
			credits: 1,
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
			credits: 2,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:stranded",
		});
		const withRefId = "22222222-2222-4222-8222-222222222222";
		await service.reserve("chat", USER_SUBJECT, {
			credits: 2,
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
		});
		expect(repository.events.get(CHAT_EVENT_ID)?.status).toBe("refunded");
		expect(repository.events.get(withRefId)?.status).toBe("reconciled");
		expect(credits.refundCalls).toContainEqual(
			expect.objectContaining({
				amount: 2,
				idempotencyKey: `settle-refund:${CHAT_EVENT_ID}`,
			}),
		);
	});

	it("terminalizes a full pending recovery page on a durable age budget so later rows are reachable", async () => {
		const { gateway, repository, service } = setup(101);
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
				credits: 1,
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
		});

		await expect(
			service.recoverStaleReservations(staleAt, 100, afterBudget),
		).resolves.toEqual({
			failed: 100,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: 100,
		});
		await expect(
			service.recoverStaleReservations(staleAt, 100, afterBudget),
		).resolves.toEqual({
			failed: 1,
			pending: 0,
			reconciled: 0,
			refunded: 0,
			scanned: 1,
		});
	});

	it("leaves pending recovery selectable before its age budget, then terminalizes it", async () => {
		const { gateway, repository, service } = setup();
		const staleAt = new Date("2026-08-01T00:00:00.000Z");
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
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
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:malformed-reserved-recovery",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_bad_reserved" } },
		});
		await service.reserve("chat", USER_SUBJECT, {
			credits: 1,
			eventId: CHILD_EVENT_ID,
			idempotencyKey: "chat:malformed-settled-recovery",
		});
		await service.captureGeneration(CHILD_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_bad_settled" } },
		});
		await service.settle(CHILD_EVENT_ID, {
			finalCredits: 1,
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
			credits: 1,
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
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:missed-queue",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_sweep" } },
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 1,
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
			credits: 1,
			eventId: CHAT_EVENT_ID,
			idempotencyKey: "chat:settled-pending-budget",
		});
		await service.captureGeneration(CHAT_EVENT_ID, {
			providerMetadata: { gateway: { generationId: "gen_pending_settled" } },
		});
		await service.settle(CHAT_EVENT_ID, {
			finalCredits: 1,
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
