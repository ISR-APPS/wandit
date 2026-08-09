import { describe, expect, it, vi } from "vitest";

import type { CapturedGeneration } from "../../../metering/domain/metering";
import {
	captureGatewayGenerationError,
	createGenerationCaptureBuffer,
} from "./generation-capture-buffer";

function capture(id: string): CapturedGeneration {
	return {
		providerMetadata: { gateway: { generationId: id } },
		stepUsage: { inputTokens: id.length, outputTokens: id.length + 1 },
	};
}

describe("createGenerationCaptureBuffer", () => {
	it("retries an exact capture in the step callback and confirms it", async () => {
		const stepCapture = capture("generation-1");
		const captureGeneration = vi
			.fn<(capture: CapturedGeneration) => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValue({ id: "ref-1" });
		const buffer = createGenerationCaptureBuffer(captureGeneration);

		await buffer.capture(stepCapture);
		await buffer.flush();

		expect(captureGeneration).toHaveBeenCalledTimes(3);
		for (const [captured] of captureGeneration.mock.calls) {
			expect(captured).toBe(stepCapture);
		}
	});

	it("retains an unconfirmed capture and replays it after the agent resolves", async () => {
		const stepCapture = capture("generation-2");
		const captureGeneration = vi
			.fn<(capture: CapturedGeneration) => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValue({ id: "ref-2" });
		const buffer = createGenerationCaptureBuffer(captureGeneration);

		await buffer.capture(stepCapture);
		expect(captureGeneration).toHaveBeenCalledTimes(3);

		await buffer.flush();

		expect(captureGeneration).toHaveBeenCalledTimes(4);
		expect(captureGeneration).toHaveBeenLastCalledWith(stepCapture);
	});

	it("replays every pending step before rejecting a failed flush", async () => {
		const first = capture("generation-fails");
		const second = capture("generation-recovers");
		const firstFailure = new Error("first generation cannot be persisted");
		const attempts = new Map<CapturedGeneration, number>();
		const captureGeneration = vi.fn(
			async (stepCapture: CapturedGeneration): Promise<unknown> => {
				const attempt = (attempts.get(stepCapture) ?? 0) + 1;
				attempts.set(stepCapture, attempt);

				if (stepCapture === first || attempt <= 3) {
					throw stepCapture === first
						? firstFailure
						: new Error("transient capture failure");
				}

				return { id: "ref-recovered" };
			},
		);
		const buffer = createGenerationCaptureBuffer(captureGeneration);

		await buffer.capture(first);
		await buffer.capture(second);

		await expect(buffer.flush()).rejects.toBe(firstFailure);
		expect(attempts.get(first)).toBe(6);
		expect(attempts.get(second)).toBe(4);

		captureGeneration.mockImplementation(async () => ({ id: "ref-final" }));
		await buffer.flush();

		// The recovered second capture was removed; only the first remained.
		expect(captureGeneration).toHaveBeenCalledTimes(11);
		expect(captureGeneration).toHaveBeenLastCalledWith(first);
	});

	it("never confirms a capture when gateway metadata has no generation id", async () => {
		const stepCapture = capture("generation-missing");
		const captureGeneration = vi.fn(async () => null);
		const buffer = createGenerationCaptureBuffer(captureGeneration);

		await buffer.capture(stepCapture);
		await expect(buffer.flush()).rejects.toThrow(
			"AI Gateway generation id is missing",
		);
		expect(captureGeneration).toHaveBeenCalledTimes(6);
	});

	it("captures a failed first-step gateway id before the caller can refund", async () => {
		const providerError = Object.assign(new Error("first step failed"), {
			generationId: "generation-failed-first-step",
		});
		const captureGeneration = vi.fn(async () => ({ id: "ref-failed-step" }));
		const buffer = createGenerationCaptureBuffer(captureGeneration);

		await expect(
			captureGatewayGenerationError(buffer, providerError),
		).resolves.toBe(true);
		await buffer.flush();

		expect(captureGeneration).toHaveBeenCalledWith({
			providerMetadata: {
				gateway: { generationId: "generation-failed-first-step" },
			},
		});
	});
});
