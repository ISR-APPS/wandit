import { tasks } from "@trigger.dev/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isR2Configured } from "../../../../infrastructure/storage/r2";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import { createGenerateImageTool } from "./generate-image.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_IMAGE_EDIT_MODEL: "openai/gpt-image-1",
	AI_IMAGE_MODEL: "openai/gpt-image-1",
	GENERATION_BILLING_MODE: "enforce",
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
	TRIGGER_SECRET_KEY: "tr_dev_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));
vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));
vi.mock("../../../../infrastructure/storage/r2", () => ({
	isR2Configured: vi.fn(),
	isUserUploadUrl: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(tasks.trigger).mockReset();
});

describe("generate_image billing", () => {
	it("prices every requested image and propagates a typed 402 before queueing", async () => {
		const attemptId = "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3";
		const imageGenerationsRepository = {
			insertAttempt: vi.fn().mockResolvedValue({
				created: true,
				id: attemptId,
				status: "queued",
			}),
		};
		const paymentRequired = new InsufficientCreditsError(15, 2);
		const meteringService = {
			findByIdempotencyKey: vi.fn().mockResolvedValue(null),
			reserveWithReplay: vi.fn().mockRejectedValue(paymentRequired),
		};
		const imageTool = createGenerateImageTool({
			availableImages: [],
			chatId: "chat_1",
			imageGenerationsRepository:
				imageGenerationsRepository as unknown as ImageGenerationsRepository,
			meteringService: meteringService as unknown as MeteringService,
			projectId: "project_1",
			userId: "user_1",
		});
		const run = imageTool.execute;

		if (!run) {
			throw new Error("generate_image tool must have execute");
		}

		await expect(
			run(
				{
					aspect: "1:1",
					count: 3,
					prompt: "A detailed studio product photograph with soft light.",
					sourceImageUrls: [],
					title: "Studio product set",
				},
				{ messages: [], toolCallId: "call_1" } as unknown as Parameters<
					typeof run
				>[1],
			),
		).rejects.toBe(paymentRequired);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			"user_1",
			{
				attemptRef: attemptId,
				credits: 15,
				idempotencyKey: `image:${attemptId}`,
				parentEventId: undefined,
			},
		);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("does not queue a new attempt when its reservation already settled", async () => {
		const attemptId = "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3";
		const imageGenerationsRepository = {
			insertAttempt: vi.fn().mockResolvedValue({
				created: true,
				id: attemptId,
				status: "queued",
			}),
		};
		const meteringService = {
			findByIdempotencyKey: vi.fn().mockResolvedValue(null),
			reserveWithReplay: vi.fn().mockResolvedValue({
				event: { id: "usage_event_1", status: "settled" },
				replay: "settled",
				replayed: true,
			}),
		};
		const imageTool = createGenerateImageTool({
			availableImages: [],
			chatId: "chat_1",
			imageGenerationsRepository:
				imageGenerationsRepository as unknown as ImageGenerationsRepository,
			meteringService: meteringService as unknown as MeteringService,
			projectId: "project_1",
			userId: "user_1",
		});
		const run = imageTool.execute;

		if (!run) {
			throw new Error("generate_image tool must have execute");
		}

		await expect(
			run(
				{
					aspect: "1:1",
					count: 1,
					prompt: "A detailed studio product photograph with soft light.",
					sourceImageUrls: [],
					title: "Studio product set",
				},
				{ messages: [], toolCallId: "call_1" } as unknown as Parameters<
					typeof run
				>[1],
			),
		).rejects.toBeInstanceOf(MeteringStateConflictError);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});
});
