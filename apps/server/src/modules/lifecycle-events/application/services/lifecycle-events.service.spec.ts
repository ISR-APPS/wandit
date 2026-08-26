import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnqueueLifecycleEvent } from "../../domain/lifecycle-event";
import type {
	LifecycleEventRow,
	LifecycleEventsRepository,
	LifecycleEventsTransaction,
} from "../../infrastructure/persistence/lifecycle-events.repository";
import { LifecycleEventsService } from "./lifecycle-events.service";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function setup() {
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

	it("enqueues the 25-credit event only when consumption reaches 2500", async () => {
		const { accepted, enqueue, service } = setup();

		await service.enqueueCreditThresholds("user-1", 2499);
		expect(enqueue).not.toHaveBeenCalled();

		await service.enqueueCreditThresholds("user-1", 2500);
		expect([...accepted.values()]).toEqual([
			{
				event: "credits_25_used",
				idempotencyKey: "credits_25_used:user-1",
				userId: "user-1",
			},
		]);
	});

	it("adds the 40-credit event with a 15-minute hold and replays do nothing", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		const { accepted, service } = setup();

		await service.enqueueCreditThresholds("user-1", 2500);
		await service.enqueueCreditThresholds("user-1", 4000);

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

		await service.enqueueCreditThresholds("user-1", 4000);
		expect(accepted).toHaveLength(2);
	});
});
