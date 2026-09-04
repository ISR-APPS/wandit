import { describe, expect, it, vi } from "vitest";

import type { MeteringService } from "../../../metering/application/services/metering.service";
import {
	createVideoBilling,
	VIDEO_REFUND_REASON_BY_KIND,
	videoEstimateHintForAttempt,
} from "./video-billing";

// Kling std $0.042/s × 10 s = $0.42 per leg → 1050 cc per unit.
const LEG_ESTIMATE = { costUsdMicros: 420_000, unitUsdMicros: 42_000 };

function setup(input?: { withEstimate?: boolean }) {
	const event = {
		id: "event_1",
		operation: "video",
		reservedCredits: 1650,
		status: "reserved",
	} as Awaited<ReturnType<MeteringService["reserve"]>>;
	const meteringService = {
		captureGeneration: vi.fn().mockResolvedValue({ id: "generation-ref-1" }),
		...(input?.withEstimate
			? { estimateMeasuredCost: vi.fn().mockResolvedValue(LEG_ESTIMATE) }
			: {}),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn().mockResolvedValue(event),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event,
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn().mockResolvedValue(event),
		settleMeasuredFromEvidence: vi.fn().mockResolvedValue(event),
		usdMicrosPerCredit: 32_000,
	};
	const billing = createVideoBilling({
		isBillingDisabled: () => false,
		meteringService,
	});

	return { billing, event, meteringService };
}

describe("createVideoBilling", () => {
	it("reserves up to three measured video units at the floor without a catalog rate", async () => {
		const { billing, event, meteringService } = setup();

		await expect(
			billing.reserve({ actorUserId: "user_1" }, "attempt_1", 3, "parent_1"),
		).resolves.toMatchObject({
			credits: 1650,
			eventId: event.id,
			operation: "video",
			units: 3,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1" },
			{
				attemptRef: "attempt_1",
				credits: 1650,
				estimatedCostUsdMicros: null,
				idempotencyKey: "video:attempt_1",
				measuredTerms: { estimatedUnitUsdMicros: null, units: 3 },
				parentEventId: "parent_1",
			},
		);
	});

	it("sizes the hold from units × the renderer's per-leg estimate", async () => {
		const { billing, meteringService } = setup({ withEstimate: true });

		await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			3,
			undefined,
			undefined,
			{
				durationSeconds: 10,
				kind: "video-extension",
				modelId: "klingai/kling-v3.0-i2v",
			},
		);

		expect(meteringService.estimateMeasuredCost).toHaveBeenCalledWith({
			audio: false,
			durationSeconds: 10,
			kind: "video",
			mode: "std",
			modelId: "klingai/kling-v3.0-i2v",
		});
		// 3 × $0.42 = $1.26 → 3938 cc at $0.032, above the 1650 cc floor.
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"video",
			{ actorUserId: "user_1" },
			expect.objectContaining({
				credits: 3938,
				estimatedCostUsdMicros: 1_260_000,
				measuredTerms: { estimatedUnitUsdMicros: 420_000, units: 3 },
			}),
		);
	});

	it("falls back to the standard tier of the kind when the row has no renderer", async () => {
		const { billing, meteringService } = setup({ withEstimate: true });

		await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			1,
			undefined,
			undefined,
			{ durationSeconds: 5, kind: "text-to-video", modelId: null },
		);

		expect(meteringService.estimateMeasuredCost).toHaveBeenCalledWith(
			expect.objectContaining({ modelId: "klingai/kling-v2.6-t2v" }),
		);
	});

	it("falls back to the fixed Seedance engine for product video", async () => {
		const { billing, meteringService } = setup({ withEstimate: true });

		await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			1,
			undefined,
			undefined,
			{ durationSeconds: 5, kind: "video-product", modelId: null },
		);

		expect(meteringService.estimateMeasuredCost).toHaveBeenCalledWith(
			expect.objectContaining({ modelId: "bytedance/seedance-2.5" }),
		);
	});

	it("settles only the delivered units provisionally for gateway repricing", async () => {
		const { billing, meteringService } = setup();
		const reservation = await billing.reserve(
			{ actorUserId: "user_1" },
			"attempt_1",
			3,
		);

		await billing.settle(reservation, 2);

		expect(meteringService.settle).toHaveBeenCalledWith("event_1", {
			costUsdMicros: null,
			finalCredits: 1100,
			pricing: "direct",
			pricingSnapshot: {
				estimatedUnitUsdMicros: null,
				mode: "measured",
				operation: "video",
				outcome: "partial",
				reviewFlags: ["no_catalog_rate"],
				source: "measured_local",
				unit: "video",
				units: 2,
				usdMicrosPerCredit: 32_000,
			},
		});
	});

	it("settles three delivered units from a live stored-output reservation", async () => {
		const { billing, event, meteringService } = setup();
		meteringService.findByIdempotencyKey.mockResolvedValueOnce(event);

		await expect(
			billing.settleExisting({ actorUserId: "user_1" }, "attempt_1", 3),
		).resolves.toBe(true);
		expect(meteringService.settleMeasuredFromEvidence).toHaveBeenCalledWith(
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
		["video-product", "product_video_failed"],
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

describe("videoEstimateHintForAttempt", () => {
	it("describes an edit by its source length and engine", () => {
		expect(
			videoEstimateHintForAttempt(
				{
					durationSeconds: 7,
					kind: "video-edit",
					model: "bytedance/seedance-2.5",
					talking: null,
				},
				1,
			),
		).toEqual({
			audio: false,
			durationSeconds: 7,
			kind: "video-edit",
			modelId: "bytedance/seedance-2.5",
		});
	});

	it("splits an extension's added length over its legs", () => {
		expect(
			videoEstimateHintForAttempt(
				{
					durationSeconds: 25,
					kind: "video-extension",
					model: "klingai/kling-v3.0-i2v",
					sourceDurationMs: 5_000,
					talking: true,
				},
				2,
			),
		).toEqual({
			audio: true,
			durationSeconds: 10,
			kind: "video-extension",
			modelId: "klingai/kling-v3.0-i2v",
		});
	});
});
