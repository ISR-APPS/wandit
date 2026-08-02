import { Logger } from "@nestjs/common";
import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	PROJECT_TITLE_PROMPT,
	ProjectTitleService,
} from "./project-title.service";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test" as string | undefined,
	AI_TITLE_MODEL: "test-provider/title-model" as string | undefined,
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("ai", () => ({
	generateText: vi.fn(),
}));

const INPUT = {
	fallbackTitle: "Build a launch landing page",
	prompt: "Build a landing page for Maison Lila's summer collection",
	usageEventId: "usage_event_1",
	userId: "user_1",
};

function setup() {
	const meteringService = {
		captureGeneration: vi.fn(
			async (): Promise<{ id: string } | null> => ({ id: "generation_ref_1" }),
		),
		completeBundledReservation: vi.fn().mockResolvedValue({
			id: "usage_event_1",
			status: "reserved",
		}),
	};

	return {
		meteringService,
		service: new ProjectTitleService(meteringService as never),
	};
}

function mockTitle(text: string): void {
	vi.mocked(generateText).mockResolvedValue({
		providerMetadata: { gateway: { generationId: "generation_1" } },
		text,
		usage: { inputTokens: 12, outputTokens: 4 },
	} as unknown as Awaited<ReturnType<typeof generateText>>);
}

beforeEach(() => {
	vi.mocked(generateText).mockReset();
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.AI_TITLE_MODEL = "test-provider/title-model";
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ProjectTitleService", () => {
	it("generates a short title with the configured gateway model", async () => {
		mockTitle("Maison Lila Summer Launch");
		const { meteringService, service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(
			"Maison Lila Summer Launch",
		);
		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				maxOutputTokens: 800,
				model: "test-provider/title-model",
				prompt:
					"User message:\nBuild a landing page for Maison Lila's summer collection",
				providerOptions: {
					gateway: {
						quotaEntityId: "user_1",
						tags: ["op:chat"],
						user: "user_1",
					},
					openai: { reasoningEffort: "low" },
				},
				system: PROJECT_TITLE_PROMPT,
			}),
		);
		expect(meteringService.captureGeneration).toHaveBeenCalledWith(
			"usage_event_1",
			{
				providerMetadata: { gateway: { generationId: "generation_1" } },
				stepUsage: {
					metering: {
						customerBilling: "bundled_unmetered",
						operation: "project_title",
					},
					providerUsage: { inputTokens: 12, outputTokens: 4 },
				},
			},
		);
		expect(meteringService.completeBundledReservation).toHaveBeenCalledWith(
			"usage_event_1",
		);
	});

	it("retries generation-reference capture without calling the provider again", async () => {
		mockTitle("Maison Lila Summer Launch");
		const { meteringService, service } = setup();
		meteringService.captureGeneration
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValueOnce({ id: "generation_ref_1" });

		await expect(service.generate(INPUT)).resolves.toBe(
			"Maison Lila Summer Launch",
		);

		expect(generateText).toHaveBeenCalledTimes(1);
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
	});

	it("does not deliver a generated title when reference capture remains unavailable", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		mockTitle("Maison Lila Summer Launch");
		const { meteringService, service } = setup();
		meteringService.captureGeneration.mockRejectedValue(
			new Error("database unavailable"),
		);

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);

		expect(generateText).toHaveBeenCalledTimes(1);
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
		expect(warn).toHaveBeenCalledWith(
			"Project title generation failed: database unavailable",
		);
	});

	it("falls back when the gateway omits the generation id", async () => {
		mockTitle("Maison Lila Summer Launch");
		const { meteringService, service } = setup();
		meteringService.captureGeneration.mockResolvedValue(null);

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);

		expect(generateText).toHaveBeenCalledTimes(1);
		expect(meteringService.captureGeneration).toHaveBeenCalledTimes(3);
	});

	it("strips wrapping quotes and backticks and collapses whitespace", async () => {
		mockTitle("  `“Maison   Lila\nSummer Launch”`  ");
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(
			"Maison Lila Summer Launch",
		);
	});

	it("strips bidi format marks before unwrapping an Arabic title", async () => {
		mockTitle("\u2067«متجر الياسمين»\u200f");
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe("متجر الياسمين");
	});

	it("clamps long titles to 60 characters on a word boundary", async () => {
		mockTitle("Premium Algerian Home Decor Collection Launch Campaign Website");
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(
			"Premium Algerian Home Decor Collection Launch Campaign",
		);
	});

	it("falls back when the model returns an empty title", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		mockTitle("  ```  ");
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);
		expect(warn).toHaveBeenCalledWith(
			"Project title generation failed: Model returned an empty project title",
		);
	});

	it("skips generation when the gateway key is missing", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		mockEnv.AI_GATEWAY_API_KEY = undefined;
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);
		expect(generateText).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			"Project title generation skipped: AI gateway is not configured",
		);
	});

	it("swallows provider errors and falls back", async () => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		vi.mocked(generateText).mockRejectedValue(new Error("gateway timeout"));
		const { service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);
		expect(warn).toHaveBeenCalledWith(
			"Project title generation failed: gateway timeout",
		);
	});

	it("audits a failed gateway generation without billing it separately", async () => {
		const gatewayError = Object.assign(new Error("provider failed"), {
			generationId: "generation_failed_1",
		});
		vi.mocked(generateText).mockRejectedValue(gatewayError);
		const { meteringService, service } = setup();

		await expect(service.generate(INPUT)).resolves.toBe(INPUT.fallbackTitle);

		expect(meteringService.captureGeneration).toHaveBeenCalledWith(
			"usage_event_1",
			{
				providerMetadata: {
					gateway: { generationId: "generation_failed_1" },
				},
				stepUsage: {
					metering: {
						customerBilling: "bundled_unmetered",
						operation: "project_title",
					},
					providerUsage: null,
				},
			},
		);
		expect(meteringService.completeBundledReservation).toHaveBeenCalledWith(
			"usage_event_1",
		);
	});

	it("uses attachment filenames when the first prompt is empty", async () => {
		mockTitle("Catalogue Été Maison Lila");
		const { service } = setup();

		await service.generate({
			attachments: [
				{
					filename: "catalogue-été.pdf",
					mediaType: "application/pdf",
					url: "https://assets.example.com/catalogue.pdf",
				},
				{
					filename: "logo-maison-lila.png",
					mediaType: "image/png",
					url: "https://assets.example.com/logo.png",
				},
			],
			fallbackTitle: "Untitled project",
			prompt: "   ",
			userId: "user_1",
		});

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt:
					"Attachment filenames:\ncatalogue-été.pdf, logo-maison-lila.png",
			}),
		);
	});

	it("limits the first prompt context to 600 characters", async () => {
		mockTitle("Long Brief Landing Page");
		const { service } = setup();
		const prompt = "x".repeat(700);

		await service.generate({ ...INPUT, prompt });

		expect(generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: `User message:\n${"x".repeat(600)}`,
			}),
		);
	});
});
