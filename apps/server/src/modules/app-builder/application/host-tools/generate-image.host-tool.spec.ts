import { describe, expect, it, vi } from "vitest";

import type { GeneratedBuildImage } from "../../../ai-chat/agent/site-builder/generate-image";
import type {
	AiUsageEvent,
	AiUsageGenerationRef,
} from "../../../metering/domain/metering";
import type { MeasuredCostEstimate } from "../../../metering/domain/model-pricing";
import type { HostToolContext } from "../../domain/ports/host-tools";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import {
	createGenerateImageTool,
	type GenerateImageHostToolDeps,
	type HostToolMetering,
} from "./generate-image.host-tool";

const GENERATED: GeneratedBuildImage = {
	height: 600,
	imageBase64: Buffer.from("png-bytes").toString("base64"),
	mediaType: "image/png",
	model: "image-model-1",
	providerMetadata: { gateway: { generationId: "gen-1" } },
	status: "generated",
	url: "https://assets.test/img.png",
	width: 800,
};

/** The child hold row `reserve`, `settle`, and `refund` answer. */
const CHILD_EVENT_FIELDS: Partial<AiUsageEvent> = {
	id: "evt_child_1",
	operation: "image",
	parentEventId: "evt_parent_1",
	pricingSnapshot: null,
	reservedCredits: 500,
};
// SAFETY: the tool reads id, operation, pricingSnapshot, and reservedCredits
// of the event; the rest of the row stays undefined.
const CHILD_EVENT = CHILD_EVENT_FIELDS as AiUsageEvent;

/** The fixed quote `estimateMeasuredCost` answers. */
const QUOTE_FIELDS: Partial<MeasuredCostEstimate> = {
	costUsdMicros: 100_000,
	credits: 500,
	unitUsdMicros: 100_000,
};
// SAFETY: the tool reads only costUsdMicros of the quote.
const QUOTE = QUOTE_FIELDS as MeasuredCostEstimate;

/** The generation ref row `captureGeneration` answers; a full row, no cast. */
const GENERATION_REF: AiUsageGenerationRef = {
	gatewayGenerationId: "gen-1",
	id: "ref-1",
	providerSource: "vercel",
	reconciledAt: null,
	reconciledCostUsdMicros: null,
	stepUsage: null,
	usageEventId: "evt_child_1",
};

function fakeMetering() {
	const calls = {
		captureGeneration: vi.fn<HostToolMetering["captureGeneration"]>(
			async () => GENERATION_REF,
		),
		estimateMeasuredCost: vi.fn<HostToolMetering["estimateMeasuredCost"]>(
			async () => QUOTE,
		),
		refund: vi.fn<HostToolMetering["refund"]>(async () => CHILD_EVENT),
		reserve: vi.fn<HostToolMetering["reserve"]>(async () => CHILD_EVENT),
		settle: vi.fn<HostToolMetering["settle"]>(async () => CHILD_EVENT),
		usdMicrosPerCredit: 32_000,
	};
	// Plain assignment: each mock has the port's call signature.
	const metering: HostToolMetering = calls;
	return { calls, metering };
}

async function setup(options: {
	generateImage?: GenerateImageHostToolDeps["generateImage"];
	holdEventId?: string | null;
	imageEditModel?: string;
}) {
	const provider = new FakeSandboxProvider();
	const sandbox = await provider.getOrCreate("project-1", {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.0.0",
	});
	const { calls, metering } = fakeMetering();
	const context: HostToolContext = {
		actorUserId: "user-1",
		chatId: "chat-1",
		holdEventId:
			options.holdEventId === undefined ? "evt_parent_1" : options.holdEventId,
		organizationId: null,
		projectId: "project-1",
		sandbox,
		subject: { actorUserId: "user-1", organizationId: null },
		turnId: "turn-1",
	};
	const tool = createGenerateImageTool(
		{
			generateImage: options.generateImage ?? (async () => GENERATED),
			imageEditModel: options.imageEditModel ?? null,
			imageModel: "image-model-1",
			logger: { info: vi.fn(), warn: vi.fn() },
			metering,
		},
		context,
	);

	const execute = tool.execute;
	if (execute === undefined) {
		throw new Error("generate_image must define execute");
	}

	return {
		calls,
		execute,
		sandbox,
	};
}

const OPTIONS = {
	context: {},
	messages: [],
	toolCallId: "tc-1",
};

describe("createGenerateImageTool", () => {
	it("rejects a .. path before any credit moves", async () => {
		const { calls, execute } = await setup({});

		const output = await execute(
			{ aspect: "1:1", path: "public/../x.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "path must be relative without .. segments",
			status: "failed",
		});
		expect(calls.reserve).not.toHaveBeenCalled();
	});

	it("rejects a path outside public/ and src/assets/", async () => {
		const { calls, execute } = await setup({});

		const output = await execute(
			{ aspect: "1:1", path: "src/x.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "path must start with public/ or src/assets/",
			status: "failed",
		});
		expect(calls.reserve).not.toHaveBeenCalled();
	});

	it("rejects a directory path before any credit moves", async () => {
		const { calls, execute } = await setup({});

		const output = await execute(
			{ aspect: "1:1", path: "public/", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "path must name a file",
			status: "failed",
		});
		expect(calls.reserve).not.toHaveBeenCalled();
	});

	it("rejects the 7th image of the turn before any reserve", async () => {
		const { calls, execute } = await setup({});

		for (let index = 0; index < 6; index += 1) {
			await execute(
				{ aspect: "1:1", path: `public/hero-${index}.png`, prompt: "a hero" },
				OPTIONS,
			);
		}
		const output = await execute(
			{ aspect: "1:1", path: "public/hero-7.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "Image budget exhausted (6 per turn)",
			status: "failed",
		});
		expect(calls.reserve).toHaveBeenCalledTimes(6);
	});

	it("fails before any reserve when the turn has no hold", async () => {
		const { calls, execute } = await setup({ holdEventId: null });

		const output = await execute(
			{ aspect: "1:1", path: "public/hero.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "billing unavailable",
			status: "failed",
		});
		expect(calls.reserve).not.toHaveBeenCalled();
	});

	it("reserves, generates, writes the bytes, and settles the child hold", async () => {
		const { calls, execute, sandbox } = await setup({});

		const output = await execute(
			{ aspect: "1:1", path: "public/hero.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			height: 600,
			path: "public/hero.png",
			status: "generated",
			url: "https://assets.test/img.png",
			width: 800,
		});
		expect(calls.reserve).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user-1", organizationId: null },
			expect.objectContaining({
				idempotencyKey: "builder-turn-image:turn-1:1",
				parentEventId: "evt_parent_1",
			}),
		);
		expect(calls.captureGeneration).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({
				providerMetadata: { gateway: { generationId: "gen-1" } },
			}),
		);
		expect(calls.settle).toHaveBeenCalledWith(
			"evt_child_1",
			expect.objectContaining({ model: "image-model-1" }),
		);
		expect(calls.refund).not.toHaveBeenCalled();
		await expect(
			sandbox.readFile("/vercel/workspace/public/hero.png"),
		).resolves.toEqual(Buffer.from("png-bytes"));
	});

	it("prices the hold on the edit model when source photos are given", async () => {
		const generateImage = vi.fn<
			GenerateImageHostToolDeps["generateImage"] & {}
		>(async () => GENERATED);
		const { calls, execute } = await setup({
			generateImage,
			imageEditModel: "edit-model-1",
		});

		await execute(
			{
				aspect: "1:1",
				path: "public/hero.png",
				prompt: "a hero",
				sourceImageUrls: ["https://photos.test/1.png"],
			},
			OPTIONS,
		);

		expect(calls.estimateMeasuredCost).toHaveBeenCalledWith({
			count: 1,
			kind: "image",
			modelId: "edit-model-1",
		});
		expect(calls.reserve.mock.calls[0]?.[2]).toMatchObject({
			model: "edit-model-1",
		});
		expect(generateImage.mock.calls[0]?.[0]).toMatchObject({
			imageEditModel: "edit-model-1",
			sourceImageUrls: ["https://photos.test/1.png"],
		});
	});

	it("refunds the child hold when the provider fails without evidence", async () => {
		const { calls, execute } = await setup({
			generateImage: async () => ({
				message: "provider down at https://gateway.test/v1/images",
				status: "failed",
			}),
		});

		const output = await execute(
			{ aspect: "1:1", path: "public/hero.png", prompt: "a hero" },
			OPTIONS,
		);

		if (Symbol.asyncIterator in output) {
			throw new Error("expected one output, not a stream");
		}
		if (output.status !== "failed") {
			throw new Error("expected failed");
		}
		expect(output.message).not.toContain("https://");
		expect(output.message).toContain("provider down");
		expect(calls.refund).toHaveBeenCalledWith(
			"evt_child_1",
			"builder_turn_image_failed",
		);
		expect(calls.settle).not.toHaveBeenCalled();
	});

	it("settles the completed unit when the provider fails with evidence", async () => {
		const { calls, execute } = await setup({
			generateImage: async () => ({
				message: "cut off after delivery",
				model: "image-model-1",
				providerMetadata: { gateway: { generationId: "gen-1" } },
				providerUnits: 1,
				status: "failed",
			}),
		});

		const output = await execute(
			{ aspect: "1:1", path: "public/hero.png", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toEqual({
			message: "cut off after delivery",
			status: "failed",
		});
		expect(calls.captureGeneration).toHaveBeenCalledTimes(1);
		expect(calls.captureGeneration.mock.calls[0]?.[0]).toBe("evt_child_1");
		expect(calls.settle).toHaveBeenCalledTimes(1);
		expect(calls.settle.mock.calls[0]?.[0]).toBe("evt_child_1");
		expect(calls.refund).not.toHaveBeenCalled();
	});

	it("rewrites the file extension to the stored media type", async () => {
		const { execute, sandbox } = await setup({});

		const output = await execute(
			{ aspect: "1:1", path: "public/hero.jpg", prompt: "a hero" },
			OPTIONS,
		);

		expect(output).toMatchObject({ path: "public/hero.png" });
		await expect(
			sandbox.readFile("/vercel/workspace/public/hero.png"),
		).resolves.toEqual(Buffer.from("png-bytes"));
	});
});
