import { describe, expect, it, vi } from "vitest";

import type { GenerationCaptureBuffer } from "../modules/ai-chat/agent/site-builder/generation-capture-buffer";
import type { SiteBuildMeteringStep } from "../modules/ai-chat/agent/site-builder/site-builder-agent";
import {
	closeBuilderMetering,
	flushPageBuildGenerationsForSettlement,
} from "./generate-page-metering";

type BuilderMeteringService = Parameters<typeof closeBuilderMetering>[0];

function meteringService(): BuilderMeteringService {
	return {
		refund: vi.fn<BuilderMeteringService["refund"]>(),
		settle: vi.fn<BuilderMeteringService["settle"]>(),
	};
}

function meteringStep(modelId: string): SiteBuildMeteringStep {
	return {
		model: { modelId, provider: "gateway" },
		providerMetadata: null,
		usage: {
			inputTokenDetails: {
				cacheReadTokens: 2,
				cacheWriteTokens: 1,
				noCacheTokens: 7,
			},
			inputTokens: 10,
			outputTokenDetails: { reasoningTokens: 2, textTokens: 3 },
			outputTokens: 5,
			totalTokens: 15,
		},
	};
}

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

describe("closeBuilderMetering", () => {
	it("settles usage from one model with that model", async () => {
		const service = meteringService();
		const step = meteringStep("google/gemini-3.8-flash");

		await closeBuilderMetering(
			service,
			{ id: "event_1" },
			[step],
			false,
			console,
		);

		expect(service.settle).toHaveBeenCalledOnce();
		expect(service.settle).toHaveBeenCalledWith("event_1", {
			modelId: "google/gemini-3.8-flash",
			pricing: "token",
			provider: "gateway",
			rawUsage: { steps: [step.usage] },
			usage: {
				inputTokenDetails: {
					cacheReadTokens: 2,
					cacheWriteTokens: 1,
					noCacheTokens: 7,
				},
				inputTokens: 10,
				outputTokens: 5,
			},
		});
		expect(service.refund).not.toHaveBeenCalled();
	});

	it("settles an OpenRouter model with its canonical id", async () => {
		const service = meteringService();

		await closeBuilderMetering(
			service,
			{ id: "event_1" },
			[meteringStep("z-ai/glm-4.6")],
			false,
			console,
		);

		expect(service.settle).toHaveBeenCalledWith(
			"event_1",
			expect.objectContaining({ modelId: "zai/glm-4.6" }),
		);
	});

	it("leaves usage from two models for reconciliation", async () => {
		const service = meteringService();
		const logger = { info: vi.fn() };

		await closeBuilderMetering(
			service,
			{ id: "event_1" },
			[
				meteringStep("google/gemini-3.8-flash"),
				meteringStep("google/gemini-3.7-flash"),
			],
			false,
			logger,
		);

		expect(service.settle).not.toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("spans multiple models"),
		);
	});

	it("keeps an unused reservation when a provider failure was observed", async () => {
		const service = meteringService();

		await closeBuilderMetering(service, { id: "event_1" }, [], true, console);

		expect(service.refund).not.toHaveBeenCalled();
		expect(service.settle).not.toHaveBeenCalled();
	});

	it("refunds an unused reservation without provider evidence", async () => {
		const service = meteringService();

		await closeBuilderMetering(service, { id: "event_1" }, [], false, console);

		expect(service.refund).toHaveBeenCalledOnce();
		expect(service.refund).toHaveBeenCalledWith(
			"event_1",
			"page_build_no_provider_usage",
		);
		expect(service.settle).not.toHaveBeenCalled();
	});
});
