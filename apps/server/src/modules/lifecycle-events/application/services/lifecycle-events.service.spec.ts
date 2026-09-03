import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnqueueLifecycleEvent } from "../../domain/lifecycle-event";
import type {
	LifecycleEventRow,
	LifecycleEventsRepository,
	LifecycleEventsTransaction,
} from "../../infrastructure/persistence/lifecycle-events.repository";
import { LifecycleEventsService } from "./lifecycle-events.service";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function setup(signupGrantCentiCredits = 700) {
	const accepted = new Map<string, EnqueueLifecycleEvent>();
	const enqueue = vi.fn(
		async (
			input: EnqueueLifecycleEvent,
			_transaction?: LifecycleEventsTransaction,
		): Promise<LifecycleEventRow | null> => {
			if (accepted.has(input.idempotencyKey)) {
				return null;
			}

			accepted.set(input.idempotencyKey, input);
			return { id: input.idempotencyKey } as LifecycleEventRow;
		},
	);
	const service = new LifecycleEventsService({
		enqueue,
		resolveSignupGrantCentiCredits: vi.fn(async () => signupGrantCentiCredits),
	} as unknown as LifecycleEventsRepository);

	return { accepted, enqueue, service };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("LifecycleEventsService", () => {
	it("delegates enqueue with an optional transaction", async () => {
		const { enqueue, service } = setup();
		const transaction = {} as LifecycleEventsTransaction;
		const input = {
			event: "website_generated",
			idempotencyKey: "website_generated:user-1",
			userId: "user-1",
		} satisfies EnqueueLifecycleEvent;

		await service.enqueue(input, transaction);

		expect(enqueue).toHaveBeenCalledWith(input, transaction);
	});

	it("enqueues the first credit event at 50 percent of a 700 cc grant", async () => {
		const { accepted, enqueue, service } = setup();

		await service.enqueueCreditThresholds("user-1", 349);
		expect(enqueue).not.toHaveBeenCalled();

		await service.enqueueCreditThresholds("user-1", 350);
		expect([...accepted.values()]).toEqual([
			{
				event: "credits_25_used",
				idempotencyKey: "credits_25_used:user-1",
				userId: "user-1",
			},
		]);
	});

	it("adds the second credit event at 80 percent of a 700 cc grant with a hold", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { accepted, service } = setup();

		await service.enqueueCreditThresholds("user-1", 350);
		await service.enqueueCreditThresholds("user-1", 560);

		expect([...accepted.values()]).toEqual([
			{
				event: "credits_25_used",
				idempotencyKey: "credits_25_used:user-1",
				userId: "user-1",
			},
			{
				dispatchAfter: new Date("2026-08-24T12:15:00.000Z"),
				event: "credits_40_used",
				idempotencyKey: "credits_40_used:user-1",
				userId: "user-1",
			},
		]);

		await service.enqueueCreditThresholds("user-1", 560);
		expect(accepted).toHaveLength(2);
	});

	it("keeps legacy 5000 cc recipients on their own 2500 and 4000 cc thresholds", async () => {
		const { accepted, enqueue, service } = setup(5000);

		await service.enqueueCreditThresholds("legacy-user", 2499);
		expect(enqueue).not.toHaveBeenCalled();

		await service.enqueueCreditThresholds("legacy-user", 2500);
		expect([...accepted.values()]).toEqual([
			{
				event: "credits_25_used",
				idempotencyKey: "credits_25_used:legacy-user",
				userId: "legacy-user",
			},
		]);

		await service.enqueueCreditThresholds("legacy-user", 3999);
		expect(accepted).toHaveLength(1);
		await service.enqueueCreditThresholds("legacy-user", 4000);
		expect(accepted.get("credits_40_used:legacy-user")).toMatchObject({
			event: "credits_40_used",
			userId: "legacy-user",
		});
	});
});
