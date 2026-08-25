import { describe, expect, it, vi } from "vitest";
import type { CreditsService } from "../../../credits/application/services/credits.service";
import { MemberCreditLimitError } from "../../../credits/domain/errors/member-credit-limit.error";
import type { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import type { OrganizationLimitsRepository } from "../../../workspaces/infrastructure/persistence/organization-limits.repository";
import type { MeteringGateway } from "../../domain/metering";
import { OPERATION_REGISTRY } from "../../domain/operation-registry";
import type { MeteringRepository } from "../../infrastructure/persistence/metering.repository";
import { MeteringService } from "./metering.service";
import type { ModelPricingService } from "./model-pricing.service";

const ORG_ID = "org_1";
const ACTOR = "user_member";

type LimitsSetup = {
	limitCredits?: number | null;
	parentEvent?: Record<string, unknown> | null;
	spent?: number;
};

function buildService(setup: LimitsSetup) {
	const insertedEvents: Record<string, unknown>[] = [];
	const consumeCalls: unknown[][] = [];

	const repository = {
		acquireOperationLock: vi.fn(async () => undefined),
		findEventById: vi.fn(async () => setup.parentEvent ?? null),
		findEventByIdempotencyKey: vi.fn(async () => null),
		insertEvent: vi.fn(async (input: Record<string, unknown>) => {
			insertedEvents.push(input);
			return { ...input, createdAt: new Date() };
		}),
		transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({ tx: true }),
		),
	} as unknown as MeteringRepository;

	const credits = {
		consume: vi.fn(async (...args: unknown[]) => {
			consumeCalls.push(args);
			return [];
		}),
	} as unknown as CreditsService;

	const limits = {
		resolveMemberLimit: vi.fn(
			async (_org: string, _user: string, exempt: boolean) =>
				setup.limitCredits === undefined || setup.limitCredits === null
					? { limitCredits: null, source: "none" as const }
					: exempt
						? { limitCredits: null, source: "none" as const }
						: {
								limitCredits: setup.limitCredits,
								source: "org-default" as const,
							},
		),
		sumMemberSpendThisMonth: vi.fn(async () => setup.spent ?? 0),
	} as unknown as OrganizationLimitsRepository;

	const service = new MeteringService(
		repository,
		credits,
		{} as ModelPricingService,
		{} as MeteringGateway,
		limits,
		{ enqueueCreditThresholds: vi.fn() } as unknown as LifecycleEventsService,
	);

	return { consumeCalls, credits, insertedEvents, limits, service };
}

function estimate(credits = 500) {
	return {
		credits,
		idempotencyKey: `k-${credits}`,
	};
}

describe("metering member limits + org subjects", () => {
	it("reserves under the org payer, stamping actor and organization", async () => {
		const { consumeCalls, insertedEvents, service } = buildService({});

		const outcome = await service.reserveWithReplay(
			"chat",
			{ actorUserId: ACTOR, organizationId: ORG_ID },
			estimate(),
		);

		expect(outcome.replayed).toBe(false);
		expect(consumeCalls[0]?.[0]).toEqual({
			organizationId: ORG_ID,
			type: "org",
		});
		expect(consumeCalls[0]?.[2]).toMatchObject({ actorUserId: ACTOR });
		expect(insertedEvents[0]).toMatchObject({
			organizationId: ORG_ID,
			userId: ACTOR,
		});
	});

	it("keeps personal reserves byte-identical: user payer, org NULL", async () => {
		const { consumeCalls, insertedEvents, limits, service } = buildService({});

		await service.reserveWithReplay("chat", { actorUserId: ACTOR }, estimate());

		expect(consumeCalls[0]?.[0]).toEqual({ type: "user", userId: ACTOR });
		expect(insertedEvents[0]).toMatchObject({
			organizationId: null,
			userId: ACTOR,
		});
		// Personal scope never consults org limits.
		expect(limits.resolveMemberLimit).not.toHaveBeenCalled();
	});

	it("rejects a reserve that would exceed the member's monthly limit", async () => {
		const { insertedEvents, service } = buildService({
			limitCredits: 1000,
			spent: 700,
		});

		await expect(
			service.reserveWithReplay(
				"chat",
				{ actorUserId: ACTOR, organizationId: ORG_ID },
				estimate(500),
			),
		).rejects.toBeInstanceOf(MemberCreditLimitError);
		// The event insert never happens; the debit rolls back with the tx.
		expect(insertedEvents).toHaveLength(0);
	});

	it("allows a reserve that exactly reaches the limit", async () => {
		const { service } = buildService({ limitCredits: 1200, spent: 700 });

		const outcome = await service.reserveWithReplay(
			"chat",
			{ actorUserId: ACTOR, organizationId: ORG_ID },
			estimate(500),
		);

		expect(outcome.replayed).toBe(false);
	});

	it("carries limit details for the UI on the error", async () => {
		const { service } = buildService({ limitCredits: 1000, spent: 900 });

		const failure = await service
			.reserveWithReplay(
				"chat",
				{ actorUserId: ACTOR, organizationId: ORG_ID },
				estimate(500),
			)
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(failure).toBeInstanceOf(MemberCreditLimitError);
		const response = (failure as MemberCreditLimitError).getResponse();
		expect(response).toMatchObject({
			code: "MEMBER_CREDIT_LIMIT_REACHED",
			// The error converts centi-credit inputs to decimal display credits.
			details: { limitCredits: 10, requiredCredits: 5, spentCredits: 9 },
		});
	});

	it("exempt actors skip the org default limit", async () => {
		const { limits, service } = buildService({
			limitCredits: 100,
			spent: 10_000,
		});

		const outcome = await service.reserveWithReplay(
			"chat",
			{
				actorIsLimitExempt: true,
				actorUserId: ACTOR,
				organizationId: ORG_ID,
			},
			estimate(500),
		);

		expect(outcome.replayed).toBe(false);
		expect(limits.resolveMemberLimit).toHaveBeenCalledWith(
			ORG_ID,
			ACTOR,
			true,
			expect.anything(),
		);
	});

	it("rejects a cross-payer parent (org child of a personal parent)", async () => {
		const { service } = buildService({
			parentEvent: {
				id: "parent-1",
				operation: "chat",
				organizationId: null,
				status: "reserved",
				userId: ACTOR,
			},
		});

		await expect(
			service.reserveWithReplay(
				"image",
				{ actorUserId: ACTOR, organizationId: ORG_ID },
				{
					credits: OPERATION_REGISTRY.image.reserveFloorCredits,
					idempotencyKey: "child-key",
					parentEventId: "parent-1",
				},
			),
		).rejects.toThrow(/another owner/i);
	});

	it("accepts a same-org parent even when a different member continues", async () => {
		const { service } = buildService({
			parentEvent: {
				id: "parent-1",
				operation: "chat",
				organizationId: ORG_ID,
				status: "reserved",
				userId: "user_other_member",
			},
		});

		const outcome = await service.reserveWithReplay(
			"image",
			{ actorUserId: ACTOR, organizationId: ORG_ID },
			{
				credits: OPERATION_REGISTRY.image.reserveFloorCredits,
				idempotencyKey: "child-key-2",
				parentEventId: "parent-1",
			},
		);

		expect(outcome.replayed).toBe(false);
	});
});
