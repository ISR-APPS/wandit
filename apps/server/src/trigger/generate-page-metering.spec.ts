import { describe, expect, it, vi } from "vitest";

import type { GenerationCaptureBuffer } from "../modules/ai-chat/agent/site-builder/generation-capture-buffer";
import { flushPageBuildGenerationsForSettlement } from "./generate-page-metering";

describe("flushPageBuildGenerationsForSettlement", () => {
	it("allows terminal settlement after every generation reference is durable", async () => {
		const buffer: GenerationCaptureBuffer = {
			capture: vi.fn(),
			flush: vi.fn().mockResolvedValue(undefined),
		};
		const onFailure = vi.fn();

		await expect(
			flushPageBuildGenerationsForSettlement(buffer, onFailure),
		).resolves.toBe(true);
		expect(buffer.flush).toHaveBeenCalledOnce();
		expect(onFailure).not.toHaveBeenCalled();
	});

	it("blocks terminal settlement when a generation reference is not durable", async () => {
		const captureFailure = new Error("generation reference write failed");
		const buffer: GenerationCaptureBuffer = {
			capture: vi.fn(),
			flush: vi.fn().mockRejectedValue(captureFailure),
		};
		const onFailure = vi.fn();

		await expect(
			flushPageBuildGenerationsForSettlement(buffer, onFailure),
		).resolves.toBe(false);
		expect(onFailure).toHaveBeenCalledOnce();
		expect(onFailure).toHaveBeenCalledWith(captureFailure);
	});

	it("allows settlement when metering did not create a capture buffer", async () => {
		const onFailure = vi.fn();

		await expect(
			flushPageBuildGenerationsForSettlement(null, onFailure),
		).resolves.toBe(true);
		expect(onFailure).not.toHaveBeenCalled();
	});
});
