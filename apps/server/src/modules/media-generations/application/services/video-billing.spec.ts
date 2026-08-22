import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import {
	createVideoBilling,
	VIDEO_REFUND_REASON_BY_KIND,
} from "./video-billing";

function setup() {
	const event = {
		id: "event_1",
		operation: "video",
		reservedCredits: 6000,
		status: "reserved",
	} as Awaited<ReturnType<MeteringService["reserve"]>>;
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref-1" }),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(event),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event,
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue(event),
		settleFixedFromEvidence: vi.fn().mockResolvedValue(event),
	};
	const billing = createVideoBilling({
		isBillingDisabled: () => false,
		meteringService,
	});

	return { billing, event, meteringService };
}

describe("createVideoBilling", () => {
	it("reserves up to three fixed video units under one stable event", async () => {
		const { billing, event, meteringService } = setup();

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", 3, "parent_1"),
		).resolves.toMatchObject({
			credits: 6000,
			eventId: event.id,
			operation: "video",
			units: 3,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1" },
			{
				attemptRef: "attempt_1",
				credits: 6000,
				idempotencyKey: "video:attempt_1",
				parentEventId: "parent_1",
			},
		);
	});

	it("settles only the delivered units at the reserved unit price", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			3,
		);

		await billing.settle(reservation, 2);

		expect(meteringService.settle).toHaveBeenCalledWith("event_1", {
			finalCredits: 4000,
			pricing: "direct",
			pricingSnapshot: {
				creditsPerUnit: 2000,
				mode: "fixed",
				operation: "video",
				source: "operation_registry",
				unit: "operation",
				units: 2,
			},
		});
	});

	it("settles three delivered units from a live stored-output reservation", async () => {
		const { billing, event, meteringService } = setup();
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(event);

		await expect(
			billing.settleExisting({ actorUserId: "user_1" }, "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleFixedFromEvidence).toHaveBeenCalledWith(
			"event_1",
			3,
		);
	});

	it("rejects reservation overflow and delivered-unit overflow", async () => {
		const { billing } = setup();

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", 4 as 3),
		).rejects.toThrow("integer from 1 to 3");

		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_2",
			2,
		);
		expect(() => billing.settle(reservation, 3)).toThrow(
			"between zero and the reserved units",
		);
	});

	it.each([
		["image-animation", "image_animation_failed"],
		["text-to-video", "image_animation_failed"],
		["video-edit", "video_edit_failed"],
		["video-extension", "video_extension_failed"],
	] as const)("maps %s refunds to %s", async (kind, reason) => {
		const { billing, event, meteringService } = setup();
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(event);

		await billing.refund({ actorUserId: "user_1" }, "attempt_1", kind);

		expect(VIDEO_REFUND_REASON_BY_KIND[kind]).toBe(reason);
		expect(meteringService.refund).toHaveBeenCalledWith("event_1", reason);
	});
});
