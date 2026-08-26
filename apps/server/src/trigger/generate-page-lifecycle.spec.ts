import { describe, expect, it, vi } from "vitest";

import type { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import {
	enqueuePageGenerationLifecycleEvent,
	pageGenerationLifecycleEvent,
} from "./generate-page-lifecycle";

describe("pageGenerationLifecycleEvent", () => {
	it.each([
		[undefined, "website_generated"],
		["website", "website_generated"],
		["cod", "landing_page_generated"],
	] as const)("maps %s builds to %s once per actor", (pageKind, event) => {
		expect(pageGenerationLifecycleEvent("member_1", pageKind)).toEqual({
			event,
			idempotencyKey: `${event}:member_1`,
			userId: "member_1",
		});
	});
});

describe("enqueuePageGenerationLifecycleEvent", () => {
	it("enqueues the exact event after the success transaction has committed", async () => {
		const enqueue = vi.fn().mockResolvedValue(null);
		const logger = { error: vi.fn() };

		await enqueuePageGenerationLifecycleEvent(
			{ enqueue } as unknown as LifecycleEventsService,
			"member_1",
			"cod",
			logger,
		);

		expect(enqueue).toHaveBeenCalledWith({
			event: "landing_page_generated",
			idempotencyKey: "landing_page_generated:member_1",
			userId: "member_1",
		});
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("logs an unexpected enqueue failure without failing the completed build", async () => {
		const enqueueError = new Error("lifecycle insert unavailable");
		const logger = { error: vi.fn() };

		await expect(
			enqueuePageGenerationLifecycleEvent(
				{
					enqueue: vi.fn().mockRejectedValue(enqueueError),
				} as unknown as LifecycleEventsService,
				"member_1",
				"website",
				logger,
			),
		).resolves.toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith(
			"Page generation lifecycle enqueue failed for user member_1: lifecycle insert unavailable",
		);
	});
});
