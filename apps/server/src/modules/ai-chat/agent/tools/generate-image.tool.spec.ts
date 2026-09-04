import { createHash } from "node:crypto";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import {
	type GenerateImageInput,
	generateImageInputSchema,
	MAX_IMAGES_PER_GENERATION,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	getPageHtml,
	isR2Configured,
	isUserUploadUrl,
} from "../../../../infrastructure/storage/r2";
import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import type { ImageGenerationsRepository } from "../../../image-generations/infrastructure/persistence/image-generations.repository";
import type { MeteringService } from "../../../metering/application/services/metering.service";
import { MeteringStateConflictError } from "../../../metering/domain/metering";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { AvailableImage } from "./animate-image.tool";
import { createGenerateImageTool } from "./generate-image.tool";

const mockEnv = vi.hoisted(() => ({
	AI_GATEWAY_API_KEY: "gateway_test",
	AI_IMAGE_EDIT_MODEL: "test/image-edit",
	AI_IMAGE_MODEL: "test/image",
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
	aspect: "3:2",
	count: 2,
	placement: PLACEMENT,
	prompt: "Editorial product photograph with warm directional studio light.",
	sourceImageUrls: [],
	title: "Hero product image",
} satisfies GenerateImageInput;

function setup(
	options: {
		availableImages?: readonly AvailableImage[];
		organizationId?: string;
		parentEventId?: string;
	} = {},
) {
	const imageGenerationsRepository = {
		insertAttempt: vi.fn(),
		markAttemptFailed: vi.fn().mockResolvedValue(true),
		markAttemptTriggered: vi.fn().mockResolvedValue(true),
	};
	const meteringService = {
		captureGeneration: vi.fn(),
		findByIdempotencyKey: vi.fn().mockResolvedValue(null),
		refund: vi.fn(),
		reserveWithReplay: vi.fn().mockResolvedValue({
			event: {
				id: "usage_event_1",
				reservedCredits: 600,
				status: "reserved",
			},
			replay: "none",
			replayed: false,
		}),
		settle: vi.fn(),
		settleMeasuredFromEvidence: vi.fn(),
	};
	const pagesRepository = {
		findActivePageByProjectUnchecked: vi.fn().mockResolvedValue({
			artifactId: "artifact_1",
			version: { id: "version_1", number: 1, r2Key: "pages/current.html" },
		}),
	};
	const imageTool = createGenerateImageTool({
		availableImages: options.availableImages ?? [],
		chatId: "chat_1",
		imageGenerationsRepository:
			imageGenerationsRepository as unknown as ImageGenerationsRepository,
		meteringService: meteringService as unknown as MeteringService,
		pagesRepository: pagesRepository as unknown as PagesRepository,
		parentEventId: options.parentEventId ?? "parent_event_1",
		projectId: "project_1",
		requestKeySeed: REQUEST_KEY_SEED,
		subject: {
			actorUserId: "user_1",
			...(options.organizationId
				? { organizationId: options.organizationId }
				: {}),
		},
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
		imageGenerationsRepository,
		meteringService,
		pagesRepository,
	};
}

beforeEach(() => {
	mockEnv.AI_GATEWAY_API_KEY = "gateway_test";
	mockEnv.AI_IMAGE_EDIT_MODEL = "test/image-edit";
	mockEnv.AI_IMAGE_MODEL = "test/image";
	mockEnv.GENERATION_BILLING_MODE = "enforce";
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
	it("rejects a missing target before billing or persistence", async () => {
		const { execute, imageGenerationsRepository, meteringService } = setup();
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
		expect(meteringService.reserveWithReplay).not.toHaveBeenCalled();
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

	it("accepts up to six separate images per call and no more", () => {
		const { placement: _, ...standaloneInput } = INPUT;

		expect(MAX_IMAGES_PER_GENERATION).toBe(6);
		expect(
			generateImageInputSchema.safeParse({ ...standaloneInput, count: 6 })
				.success,
		).toBe(true);
		expect(
			generateImageInputSchema.safeParse({ ...standaloneInput, count: 7 })
				.success,
		).toBe(false);
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

	it("persists placement, reserves the image count, and triggers the billed child run", async () => {
		const { execute, imageGenerationsRepository, meteringService } = setup();
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
			},
			title: INPUT.title,
		});
		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			{
				attemptRef: ATTEMPT_ID,
				// No catalog rate in this double: 2 × the 100 cc image floor.
				credits: 200,
				estimatedCostUsdMicros: null,
				idempotencyKey: `image:${ATTEMPT_ID}`,
				measuredTerms: { estimatedUnitUsdMicros: null, units: 2 },
				parentEventId: "parent_event_1",
			},
		);
		expect(idempotencyKeys.create).toHaveBeenCalledWith(
			`image-generation:${ATTEMPT_ID}`,
			{ scope: "global" },
		);
		expect(tasks.trigger).toHaveBeenCalledWith(
			"generate-image",
			{
				attemptId: ATTEMPT_ID,
				billingMode: "enforce",
				organizationId: null,
				parentEventId: "parent_event_1",
				projectId: "project_1",
				userId: "user_1",
			},
			expect.objectContaining({
				concurrencyKey: "user:user_1",
				idempotencyKey: "global-image-generation-key",
			}),
		);
		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
	});

	it("partitions the task queue by organization payer", async () => {
		const { execute, imageGenerationsRepository } = setup({
			organizationId: "org_1",
		});
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_org",
		} as Awaited<ReturnType<typeof tasks.trigger>>);
		const { placement: _, ...standaloneInput } = INPUT;

		await execute(standaloneInput);

		expect(tasks.trigger).toHaveBeenCalledWith(
			"generate-image",
			expect.objectContaining({ organizationId: "org_1" }),
			expect.objectContaining({ concurrencyKey: "org:org_1" }),
		);
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

describe("generate_image billing", () => {
	it("prices every requested image and propagates a typed 402 before queueing", async () => {
		const { execute, imageGenerationsRepository, meteringService } = setup();
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		const paymentRequired = new InsufficientCreditsError(15, 2);
		meteringService.reserveWithReplay.mockRejectedValue(paymentRequired);
		const { placement: _, ...standaloneInput } = INPUT;

		await expect(execute({ ...standaloneInput, count: 3 })).rejects.toBe(
			paymentRequired,
		);

		expect(meteringService.reserveWithReplay).toHaveBeenCalledWith(
			"image",
			{ actorUserId: "user_1" },
			{
				attemptRef: ATTEMPT_ID,
				credits: 300,
				estimatedCostUsdMicros: null,
				idempotencyKey: `image:${ATTEMPT_ID}`,
				measuredTerms: { estimatedUnitUsdMicros: null, units: 3 },
				parentEventId: "parent_event_1",
			},
		);
		expect(tasks.trigger).not.toHaveBeenCalled();
	});

	it("does not queue a new attempt when its reservation already settled", async () => {
		const { execute, imageGenerationsRepository, meteringService } = setup();
		imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		meteringService.reserveWithReplay.mockResolvedValue({
			event: {
				id: "usage_event_1",
				reservedCredits: 300,
				status: "settled",
			},
			replay: "settled",
			replayed: true,
		});
		const { placement: _, ...standaloneInput } = INPUT;

		await expect(
			execute({ ...standaloneInput, count: 1 }),
		).rejects.toBeInstanceOf(MeteringStateConflictError);

		expect(tasks.trigger).not.toHaveBeenCalled();
	});
});

describe("generate_image source photos", () => {
	const sourceUrls = Array.from(
		{ length: 8 },
		(_, index) =>
			`https://assets.example.com/uploads/user_1/photo-${index + 1}.jpg`,
	);
	const standaloneInput: GenerateImageInput = {
		aspect: INPUT.aspect,
		count: 1,
		prompt: INPUT.prompt,
		sourceImageUrls: [],
		title: INPUT.title,
	};

	function queueable(availableUrls: readonly string[]) {
		const context = setup({
			availableImages: availableUrls.map((url) => ({
				mediaType: "image/jpeg" as const,
				url,
			})),
		});
		context.imageGenerationsRepository.insertAttempt.mockResolvedValue({
			created: true,
			id: ATTEMPT_ID,
			status: "queued",
		});
		vi.mocked(tasks.trigger).mockResolvedValue({
			id: "run_123",
		} as Awaited<ReturnType<typeof tasks.trigger>>);

		return context;
	}

	it("keeps the first six distinct sources and tells the model about the rest", async () => {
		const { execute, imageGenerationsRepository } = queueable(sourceUrls);

		const output = await execute({
			...standaloneInput,
			// A repeated URL is one photo, not a skipped one.
			sourceImageUrls: [...sourceUrls, sourceUrls[0] as string],
		});

		expect(imageGenerationsRepository.insertAttempt).toHaveBeenCalledWith(
			expect.objectContaining({ sourceImageUrls: sourceUrls.slice(0, 6) }),
		);
		expect(output).toMatchObject({
			attemptId: ATTEMPT_ID,
			message: expect.stringContaining(
				"the first 6 were used and 2 were skipped",
			),
			status: "queued",
		});
		expect((output as { message: string }).message).toContain(
			"Tell the user this gently",
		);
	});

	it("never checks ownership of a skipped source", async () => {
		// Only the six kept photos are attachments; the two extras are not.
		const { execute } = queueable(sourceUrls.slice(0, 6));

		const output = await execute({
			...standaloneInput,
			sourceImageUrls: sourceUrls,
		});

		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
	});

	it("keeps the note when Trigger.dev does not confirm the handoff", async () => {
		const { execute } = queueable(sourceUrls);
		vi.mocked(tasks.trigger).mockRejectedValue(new Error("socket hang up"));

		const output = await execute({
			...standaloneInput,
			sourceImageUrls: sourceUrls,
		});

		expect(output).toMatchObject({
			attemptId: ATTEMPT_ID,
			message: expect.stringContaining("did not confirm the handoff"),
			status: "queued",
		});
		expect((output as { message: string }).message).toContain("2 were skipped");
	});

	it("adds no note when every source fits", async () => {
		const { execute } = queueable(sourceUrls);

		const output = await execute({
			...standaloneInput,
			sourceImageUrls: sourceUrls.slice(0, 6),
		});

		expect(output).toMatchObject({ attemptId: ATTEMPT_ID, status: "queued" });
		expect((output as { message: string }).message).not.toContain("skipped");
	});
});
