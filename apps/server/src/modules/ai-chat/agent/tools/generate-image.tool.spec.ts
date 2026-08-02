import { createHash } from "node:crypto";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { GenerateImageInput } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getPageHtml,
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
import type { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import { createGenerateImageTool } from "./generate-image.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_IMAGE_EDIT_MODEL: "test/image-edit",
	AI_IMAGE_MODEL: "test/image",
	R2_PUBLIC_BASE_URL: "https://assets.example.com",
	TRIGGER_SECRET_KEY: "tr_dev_test",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@trigger.dev/sdk", () => ({
	idempotencyKeys: { create: vi.fn() },
	tasks: { trigger: vi.fn() },
}));

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getPageHtml: vi.fn(),
	isR2Configured: vi.fn(),
	isUserUploadUrl: vi.fn(),
}));

const ATTEMPT_ID = "b48dfa65-13a2-4bd8-af89-d01c4bbdb1e3";
const REQUEST_KEY_SEED = "de890510-e194-4a18-8d4a-a30f80dbe32a";
const PLACEMENT = {
	imageIndex: 2,
	kind: "image-src" as const,
	wid: "hero-image",
};
const INPUT = {
	aspect: "3:2" as const,
	count: 2,
	placement: PLACEMENT,
	prompt: "Editorial product photograph with warm directional studio light.",
	sourceImageUrls: [],
	title: "Hero product image",
};

function setup(options: { quality?: string } = {}) {
	const imageGenerationsRepository = {
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn(),
	};
	const generationPolicyService = {
		assertCanGenerate: vi.fn().mockResolvedValue(undefined),
		refundGenerationReservation: vi.fn().mockResolvedValue([]),
	};
	const pagesRepository = {
		findActivePageByProjectUnchecked: vi.fn().mockResolvedValue({
			artifactId: "artifact_1",
			version: { id: "version_1", number: 1, r2Key: "pages/current.html" },
		}),
	};
	const imageTool = createGenerateImageTool({
		availableImages: [],
		chatId: "chat_1",
		generationPolicyService:
			generationPolicyService as unknown as GenerationPolicyService,
		imageGenerationsRepository:
			imageGenerationsRepository as unknown as ImageGenerationsRepository,
		pagesRepository: pagesRepository as unknown as PagesRepository,
		projectId: "project_1",
		quality: options.quality,
		requestKeySeed: REQUEST_KEY_SEED,
		userId: "user_1",
	});
	const run = imageTool.execute;

	if (!run) {
		throw new Error("generate_image tool must have execute");
	}

	const execute = (input: GenerateImageInput = INPUT) =>
		run(input, {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof run>[1]);

	return {
		execute,
		generationPolicyService,
		imageGenerationsRepository,
		pagesRepository,
	};
}

beforeEach(() => {
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.AI_IMAGE_EDIT_MODEL = "test/image-edit";
	mockEnv.AI_IMAGE_MODEL = "test/image";
	mockEnv.R2_PUBLIC_BASE_URL = "https://assets.example.com";
	mockEnv.TRIGGER_SECRET_KEY = "tr_dev_test";
	vi.mocked(getPageHtml).mockReset();
	vi.mocked(getPageHtml).mockResolvedValue(
		'<html><body><img data-wid="hero-image" src="/old.jpg"></body></html>',
	);
	vi.mocked(isR2Configured).mockReset();
	vi.mocked(isR2Configured).mockReturnValue(true);
	vi.mocked(isUserUploadUrl).mockReset();
	vi.mocked(isUserUploadUrl).mockReturnValue(true);
	vi.mocked(idempotencyKeys.create).mockReset();
	vi.mocked(idempotencyKeys.create).mockResolvedValue(
		"global-image-generation-key" as Awaited<
			ReturnType<typeof idempotencyKeys.create>
		>,
	);
	vi.mocked(tasks.trigger).mockReset();
});

describe("generate_image placement", () => {
	it("rejects a missing target before policy checks or persistence", async () => {
		const { execute, generationPolicyService, imageGenerationsRepository } =
			setup();
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body><img data-wid="another-image"></body></html>',
		);

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining(
				'No element with data-wid="hero-image" exists',
			),
			status: "unavailable",
		});
		expect(generationPolicyService.assertCanGenerate).not.toHaveBeenCalled();
		expect(imageGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("rejects a target that is not an img", async () => {
		const { execute, imageGenerationsRepository } = setup();
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body><div data-wid="hero-image"></div></body></html>',
		);

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining("is not an <img>"),
			status: "unavailable",
		});
		expect(imageGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("rejects a duplicated target wid", async () => {
		const { execute, imageGenerationsRepository } = setup();
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body><img data-wid="hero-image"><img data-wid="hero-image"></body></html>',
		);

		const output = await execute();

		expect(output).toMatchObject({
			message: expect.stringContaining('data-wid "hero-image" is not unique'),
			status: "unavailable",
		});
		expect(imageGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("accepts a deterministic wid from the canonical stamped page", async () => {
		const { execute, imageGenerationsRepository } = setup();
		vi.mocked(getPageHtml).mockResolvedValue(
			'<html><body><section data-wid="hero"><img src="/old.jpg"></section></body></html>',
		);
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: false,
			id: ATTEMPT_ID,
			status: "succeeded",
		});

		const output = await execute({
			...INPUT,
			placement: { ...PLACEMENT, wid: "e-1" },
		});

		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
		expect(imageGenerationsRepository.insertAttempt).toHaveBeenCalledOnce();
	});

	it("rejects an image index outside the generated count", async () => {
		const { execute, imageGenerationsRepository, pagesRepository } = setup();

		const output = await execute({
			...INPUT,
			count: 1,
			placement: { ...PLACEMENT, imageIndex: 2 },
		});

		expect(output).toMatchObject({
			message: expect.stringContaining("only generates 1"),
			status: "unavailable",
		});
		expect(
			pagesRepository.findActivePageByProjectUnchecked,
		).not.toHaveBeenCalled();
		expect(imageGenerationsRepository.insertAttempt).not.toHaveBeenCalled();
	});

	it("persists pending placement and includes it in the request hash", async () => {
		const { execute, imageGenerationsRepository } = setup({ quality: "high" });
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);
		const expectedRequestKey = createHash("sha256")
			.update(
				JSON.stringify({
					aspect: INPUT.aspect,
					count: INPUT.count,
					prompt: INPUT.prompt,
					placement: PLACEMENT,
					request: REQUEST_KEY_SEED,
					sourceImageUrls: [],
				}),
			)
			.digest("hex");

		const output = await execute();

		expect(imageGenerationsRepository.insertAttempt).toHaveBeenCalledWith({
			aspect: "3:2",
			chatId: "chat_1",
			count: 2,
			projectId: "project_1",
			prompt: INPUT.prompt,
			requestKey: expectedRequestKey,
			sourceImageUrls: [],
			spec: {
				placement: { ...PLACEMENT, status: "pending" },
				quality: "high",
			},
			title: INPUT.title,
		});
		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
	});

	it("keeps standalone generation independent of active page HTML", async () => {
		const { execute, imageGenerationsRepository, pagesRepository } = setup();
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: false,
			id: ATTEMPT_ID,
			status: "succeeded",
		});

		const { placement: _, ...standaloneInput } = INPUT;
		const output = await execute(standaloneInput);

		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
		expect(
			pagesRepository.findActivePageByProjectUnchecked,
		).not.toHaveBeenCalled();
		expect(getPageHtml).not.toHaveBeenCalled();
		expect(imageGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ spec: undefined }),
		);
	});
});
