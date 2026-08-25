import { PgDialect } from "@wandit/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getObjectContentType,
	imageGenerationKey,
} from "../infrastructure/storage/r2";
import {
	type ImagePlacementDependencies,
	settleImagePlacement,
} from "../modules/image-generations/application/services/image-generation-placement.service";
import type {
	GeneratedImageResult,
	ImageGenerationAttemptState,
} from "../modules/image-generations/application/services/image-generation-runner";
import { generateStandaloneImage } from "../modules/image-generations/application/services/image-generator";
import { createStoredImagesRecovery } from "../modules/image-generations/application/services/stored-images-recovery";
import { createImageGenerationRuntime } from "./image-generation.runtime";

vi.mock("../infrastructure/storage/r2", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../infrastructure/storage/r2")>();

	return {
		...original,
		getObjectContentType: vi.fn(),
		imageGenerationKey: vi.fn(
			(
				projectId: string,
				attemptId: string,
				index: number,
				extension: string,
			) => `images/${projectId}/${attemptId}/img-${index}.${extension}`,
		),
		publicAssetUrl: vi.fn((key: string) => `https://assets.example.com/${key}`),
	};
});

vi.mock(
	"../modules/image-generations/application/services/image-generator",
	() => ({ generateStandaloneImage: vi.fn() }),
);

const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const GENERATED_URL =
	"https://assets.example.com/images/project/attempt/img-1.png";

function makeAttempt(
	placement: Record<string, unknown> = {
		imageIndex: 1,
		kind: "image-src",
		status: "pending",
		wid: "e-3",
	},
): ImageGenerationAttemptState {
	return {
		aspect: "1:1",
		completedAt: new Date("2026-01-01T00:05:00Z"),
		count: 1,
		error: null,
		id: ATTEMPT_ID,
		images: makeImages(),
		organizationId: null,
		projectDeletedAt: null,
		projectId: PROJECT_ID,
		prompt: "A studio product photograph",
		sourceImageUrls: [],
		spec: { placement },
		startedAt: new Date("2026-01-01T00:00:00Z"),
		status: "succeeded",
		title: "Product photo",
		triggerRunId: "run_1",
		userId: "user_1",
	};
}

function makeImages(): GeneratedImageResult[] {
	return [{ mediaType: "image/png", url: GENERATED_URL }];
}

function successPersistenceDb(lifecycleError?: Error) {
	const updateReturning = vi.fn().mockResolvedValue([{ id: ATTEMPT_ID }]);
	const updateWhere = vi.fn(() => ({ returning: updateReturning }));
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));
	const insertReturning = lifecycleError
		? vi.fn().mockRejectedValue(lifecycleError)
		: vi.fn().mockResolvedValue([{ id: "lifecycle_1" }]);
	const onConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	const tx = { insert, update };
	const transaction = vi.fn(
		async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
	);

	return {
		db: { transaction },
		insert,
		insertReturning,
		transaction,
		update,
		updateReturning,
		values,
	};
}

beforeEach(() => {
	vi.mocked(generateStandaloneImage).mockReset();
	vi.mocked(getObjectContentType).mockReset();
	vi.mocked(imageGenerationKey).mockClear();
});

describe("createImageGenerationRuntime", () => {
	it("snapshots the queue actor while claiming a queued attempt", async () => {
		const claimed = makeAttempt();
		claimed.status = "generating";
		const limit = vi.fn().mockResolvedValue([claimed]);
		const selectWhere = vi.fn(() => ({ limit }));
		const innerJoin = vi.fn(() => ({ where: selectWhere }));
		const from = vi.fn(() => ({ innerJoin }));
		const select = vi.fn(() => ({ from }));
		const returning = vi.fn().mockResolvedValue([{ id: ATTEMPT_ID }]);
		const updateWhere = vi.fn(() => ({ returning }));
		const set = vi.fn((_values: Record<string, unknown>) => ({
			where: updateWhere,
		}));
		const update = vi.fn(() => ({ set }));
		const runtime = createImageGenerationRuntime({ select, update } as never, {
			capture: vi.fn(),
		});
		const queued = makeAttempt();
		queued.status = "queued";
		const startedAt = new Date("2026-01-01T00:00:00Z");

		await expect(
			runtime.runner.claimQueued(queued, {
				actorUserId: "acting_member_2",
				runId: "run_1",
				startedAt,
			}),
		).resolves.toEqual(claimed);

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ startedAt, triggerRunId: "run_1" }),
		);
		const specExpression = set.mock.calls[0]?.[0]?.spec;
		const rendered = new PgDialect().sqlToQuery(
			specExpression as Parameters<PgDialect["sqlToQuery"]>[0],
		);
		expect(rendered.sql).toContain("coalesce");
		expect(rendered.sql).toContain("|| jsonb_build_object('actorUserId'");
		expect(rendered.params).toContain("acting_member_2");
	});

	it("atomically records image_generated for the queue actor in an org workspace", async () => {
		const persistence = successPersistenceDb();
		const analytics = { capture: vi.fn() };
		const runtime = createImageGenerationRuntime(
			persistence.db as never,
			analytics,
		);
		const attempt = makeAttempt();
		attempt.organizationId = "org_1";
		attempt.userId = "project_creator_1";

		await expect(
			runtime.runner.markSucceeded(
				attempt,
				makeImages(),
				new Date("2026-01-01T00:05:00Z"),
				"acting_member_2",
			),
		).resolves.toBe(true);

		expect(persistence.transaction).toHaveBeenCalledOnce();
		expect(persistence.values).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "image_generated",
				idempotencyKey: "image_generated:acting_member_2",
				userId: "acting_member_2",
			}),
		);
		expect(
			persistence.updateReturning.mock.invocationCallOrder[0] as number,
		).toBeLessThan(
			persistence.insertReturning.mock.invocationCallOrder[0] as number,
		);
		expect(analytics.capture).toHaveBeenCalledWith(
			"acting_member_2",
			"generation_completed",
			expect.objectContaining({ generationId: ATTEMPT_ID, kind: "image" }),
		);
	});

	it("propagates an unexpected lifecycle insert failure before success commits", async () => {
		const lifecycleError = new Error("lifecycle insert unavailable");
		const persistence = successPersistenceDb(lifecycleError);
		const analytics = { capture: vi.fn() };
		const runtime = createImageGenerationRuntime(
			persistence.db as never,
			analytics,
		);

		await expect(
			runtime.runner.markSucceeded(
				makeAttempt(),
				makeImages(),
				new Date("2026-01-01T00:05:00Z"),
				"user_1",
			),
		).rejects.toBe(lifecycleError);
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("does not enqueue when the guarded success transition loses its race", async () => {
		const persistence = successPersistenceDb();
		persistence.updateReturning.mockResolvedValueOnce([]);
		const analytics = { capture: vi.fn() };
		const runtime = createImageGenerationRuntime(
			persistence.db as never,
			analytics,
		);

		await expect(
			runtime.runner.markSucceeded(
				makeAttempt(),
				makeImages(),
				new Date("2026-01-01T00:05:00Z"),
				"user_1",
			),
		).resolves.toBe(false);
		expect(persistence.insert).not.toHaveBeenCalled();
		expect(analytics.capture).not.toHaveBeenCalled();
	});

	it("collects variant thunks and drains every one with all-settled semantics", async () => {
		const firstVariants = vi
			.fn()
			.mockRejectedValue(new Error("variant failed"));
		const secondVariants = vi.fn().mockResolvedValue(undefined);
		vi.mocked(generateStandaloneImage)
			.mockResolvedValueOnce({
				height: 1024,
				mediaType: "image/webp",
				model: "test/image",
				providerMetadata: {},
				status: "generated",
				storeVariants: firstVariants,
				url: "https://assets.example.com/img-1.webp",
				width: 1024,
			})
			.mockResolvedValueOnce({
				height: 1024,
				mediaType: "image/webp",
				model: "test/image",
				providerMetadata: {},
				status: "generated",
				storeVariants: secondVariants,
				url: "https://assets.example.com/img-2.webp",
				width: 1024,
			});
		const runtime = createImageGenerationRuntime({} as never, {
			capture: vi.fn(),
		});
		const attempt = makeAttempt();

		const results = await Promise.all([
			runtime.runner.generateOne(attempt, { actorUserId: "user_1" }, 1),
			runtime.runner.generateOne(attempt, { actorUserId: "user_1" }, 2),
		]);

		expect(generateStandaloneImage).toHaveBeenCalledWith(
			expect.objectContaining({ deferVariants: true, index: 1 }),
		);
		expect(results).toEqual([
			expect.not.objectContaining({ storeVariants: expect.anything() }),
			expect.not.objectContaining({ storeVariants: expect.anything() }),
		]);
		expect(firstVariants).not.toHaveBeenCalled();
		expect(secondVariants).not.toHaveBeenCalled();

		await expect(runtime.flushDeferredWork()).resolves.toBeUndefined();
		expect(firstVariants).toHaveBeenCalledOnce();
		expect(secondVariants).toHaveBeenCalledOnce();

		await runtime.flushDeferredWork();
		expect(firstVariants).toHaveBeenCalledOnce();
		expect(secondVariants).toHaveBeenCalledOnce();
	});

	it("wires progress through a generating-status-guarded repository update", async () => {
		const returning = vi.fn().mockResolvedValue([{ id: ATTEMPT_ID }]);
		const where = vi.fn((_condition: unknown) => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const runtime = createImageGenerationRuntime({ update } as never, {
			capture: vi.fn(),
		});
		const progress = [{ index: 2, mediaType: "image/png", url: GENERATED_URL }];

		await expect(
			runtime.runner.persistProgress(makeAttempt(), progress),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith({ images: progress });
		expect(where).toHaveBeenCalledOnce();
	});
});

describe("createStoredImagesRecovery", () => {
	it("scans every requested index and returns an indexed sparse subset", async () => {
		vi.mocked(getObjectContentType).mockImplementation(async (key) => {
			if (key.endsWith("img-1.png")) {
				return "image/png";
			}
			if (key.endsWith("img-3.webp")) {
				return "image/webp";
			}
			return null;
		});
		const recover = createStoredImagesRecovery();

		await expect(
			recover({ count: 4, id: ATTEMPT_ID, projectId: PROJECT_ID }),
		).resolves.toEqual([
			{
				index: 1,
				mediaType: "image/png",
				url: `https://assets.example.com/images/${PROJECT_ID}/${ATTEMPT_ID}/img-1.png`,
			},
			{
				index: 3,
				mediaType: "image/webp",
				url: `https://assets.example.com/images/${PROJECT_ID}/${ATTEMPT_ID}/img-3.webp`,
			},
		]);
		expect(imageGenerationKey).toHaveBeenCalledWith(
			PROJECT_ID,
			ATTEMPT_ID,
			4,
			"webp",
		);
	});
});

function pageHtml(
	target = `<img data-wid="e-3" src="https://assets.example.com/old.png">`,
): string {
	return `<!doctype html><html><body><main><section data-wid="hero">${target}</section></main></body></html>`;
}

function makeDependencies(
	overrides: Partial<ImagePlacementDependencies> = {},
): ImagePlacementDependencies {
	return {
		findReceipt: vi.fn().mockResolvedValue(null),
		loadCurrentPageHtml: vi.fn().mockResolvedValue(pageHtml()),
		pageEditsService: {
			applyAiOps: vi
				.fn()
				.mockResolvedValue({ status: "applied", versionNumber: 4 }),
		},
		updatePlacement: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("settleImagePlacement", () => {
	it("does nothing for standalone generation", async () => {
		const attempt = makeAttempt();
		attempt.spec = null;
		const dependencies = makeDependencies();

		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.loadCurrentPageHtml).not.toHaveBeenCalled();
		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).not.toHaveBeenCalled();
	});

	it("applies the selected image once and skips a terminal retry", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies({
			updatePlacement: vi
				.fn()
				.mockImplementation(async (_attempt, placement) => {
					Object.assign(
						(attempt.spec as { placement: Record<string, unknown> }).placement,
						placement,
					);
				}),
		});

		await settleImagePlacement(attempt, makeImages(), dependencies);
		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.pageEditsService.applyAiOps).toHaveBeenCalledTimes(1);
		expect(dependencies.pageEditsService.applyAiOps).toHaveBeenCalledWith(
			PROJECT_ID,
			[
				{
					kind: "image-src",
					value: GENERATED_URL,
					wid: "e-3",
				},
			],
			{
				attemptId: ATTEMPT_ID,
				kind: "image-generation-placement",
			},
		);
		expect(dependencies.updatePlacement).toHaveBeenCalledTimes(1);
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			attempt,
			expect.objectContaining({
				status: "applied",
				versionNumber: 4,
				wid: "e-3",
			}),
		);
	});

	it("resolves an indexed placement from a sparse successful subset", async () => {
		const attempt = makeAttempt({
			imageIndex: 3,
			kind: "image-src",
			status: "pending",
			wid: "e-3",
		});
		const sparseImages = [
			{ index: 1, mediaType: "image/png", url: GENERATED_URL },
			{
				index: 3,
				mediaType: "image/png",
				url: "https://assets.example.com/images/project/attempt/img-3.png",
			},
		];
		const dependencies = makeDependencies();

		await settleImagePlacement(attempt, sparseImages, dependencies);

		expect(dependencies.pageEditsService.applyAiOps).toHaveBeenCalledWith(
			PROJECT_ID,
			[
				{
					kind: "image-src",
					value: "https://assets.example.com/images/project/attempt/img-3.png",
					wid: "e-3",
				},
			],
			expect.anything(),
		);
	});

	it("honors a historical receipt after a later edit changed the image", async () => {
		const attempt = makeAttempt();
		const dependencies = makeDependencies({
			findReceipt: vi.fn().mockResolvedValue({ number: 4 }),
			loadCurrentPageHtml: vi
				.fn()
				.mockResolvedValue(
					pageHtml('<img data-wid="e-3" src="later-user-edit.png">'),
				),
		});

		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.loadCurrentPageHtml).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			attempt,
			expect.objectContaining({ status: "applied", versionNumber: 4 }),
		);
	});

	it("repairs a raced failed status only when an immutable receipt exists", async () => {
		const attempt = makeAttempt({
			imageIndex: 1,
			kind: "image-src",
			status: "failed",
			wid: "e-3",
		});
		const dependencies = makeDependencies({
			findReceipt: vi.fn().mockResolvedValue({ number: 4 }),
		});

		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.loadCurrentPageHtml).not.toHaveBeenCalled();
		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			attempt,
			expect.objectContaining({ status: "applied", versionNumber: 4 }),
		);
	});

	it("leaves an honest failed status terminal when no receipt exists", async () => {
		const attempt = makeAttempt({
			imageIndex: 1,
			kind: "image-src",
			status: "failed",
			wid: "e-3",
		});
		const dependencies = makeDependencies();

		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.findReceipt).toHaveBeenCalledOnce();
		expect(dependencies.loadCurrentPageHtml).not.toHaveBeenCalled();
		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).not.toHaveBeenCalled();
	});

	it("re-checks the receipt after a page CAS conflict", async () => {
		const findReceipt = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ number: 5 });
		const dependencies = makeDependencies({
			findReceipt,
			pageEditsService: {
				applyAiOps: vi.fn().mockResolvedValue({
					message:
						"The page changed mid-edit (another save landed first) — re-read the section and retry.",
					status: "rejected",
				}),
			},
		});

		await settleImagePlacement(makeAttempt(), makeImages(), dependencies);

		expect(findReceipt).toHaveBeenCalledTimes(2);
		expect(dependencies.loadCurrentPageHtml).toHaveBeenCalledTimes(1);
		expect(dependencies.pageEditsService.applyAiOps).toHaveBeenCalledTimes(1);
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ status: "applied", versionNumber: 5 }),
		);
	});

	it("retries the page edit once after a CAS conflict", async () => {
		const pageChanged = {
			message:
				"The page changed mid-edit (another save landed first) — re-read the section and retry.",
			status: "rejected" as const,
		};
		const applyAiOps = vi
			.fn()
			.mockResolvedValueOnce(pageChanged)
			.mockResolvedValueOnce({ status: "applied", versionNumber: 5 });
		const dependencies = makeDependencies({
			pageEditsService: { applyAiOps },
		});

		await settleImagePlacement(makeAttempt(), makeImages(), dependencies);

		expect(dependencies.findReceipt).toHaveBeenCalledTimes(2);
		expect(dependencies.loadCurrentPageHtml).toHaveBeenCalledTimes(2);
		expect(applyAiOps).toHaveBeenCalledTimes(2);
		expect(applyAiOps).toHaveBeenNthCalledWith(
			2,
			PROJECT_ID,
			[
				{
					kind: "image-src",
					value: GENERATED_URL,
					wid: "e-3",
				},
			],
			{
				attemptId: ATTEMPT_ID,
				kind: "image-generation-placement",
			},
		);
		expect(dependencies.updatePlacement).toHaveBeenCalledOnce();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ status: "applied", versionNumber: 5 }),
		);
	});

	it("fails placement after exhausting the single CAS retry", async () => {
		const pageChanged = {
			message:
				"The page changed mid-edit (another save landed first) — re-read the section and retry.",
			status: "rejected" as const,
		};
		const applyAiOps = vi.fn().mockResolvedValue(pageChanged);
		const dependencies = makeDependencies({
			pageEditsService: { applyAiOps },
		});

		await settleImagePlacement(makeAttempt(), makeImages(), dependencies);

		expect(dependencies.findReceipt).toHaveBeenCalledTimes(3);
		expect(dependencies.loadCurrentPageHtml).toHaveBeenCalledTimes(2);
		expect(applyAiOps).toHaveBeenCalledTimes(2);
		expect(dependencies.updatePlacement).toHaveBeenCalledOnce();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				reason: pageChanged.message,
				status: "failed",
			}),
		);
		expect(dependencies.updatePlacement).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ versionNumber: expect.any(Number) }),
		);
	});

	it("fails pending placement without editing a soft-deleted project", async () => {
		const attempt = makeAttempt();
		attempt.projectDeletedAt = new Date("2026-01-01T00:06:00Z");
		const dependencies = makeDependencies();

		await settleImagePlacement(attempt, makeImages(), dependencies);

		expect(dependencies.findReceipt).toHaveBeenCalledOnce();
		expect(dependencies.loadCurrentPageHtml).not.toHaveBeenCalled();
		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).toHaveBeenCalledOnce();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			attempt,
			expect.objectContaining({
				reason:
					"The project was deleted before the generated image could be applied.",
				status: "failed",
			}),
		);
	});

	it.each([
		[
			"vanished",
			pageHtml('<img data-wid="different-image" src="old.png">'),
			'No element with data-wid="e-3" remains on the page.',
		],
		[
			"changed tag",
			pageHtml('<figure data-wid="e-3"></figure>'),
			'The element with data-wid="e-3" is no longer an <img>.',
		],
	] as const)("records an honest failure when the target %s", async (_label, html, reason) => {
		const dependencies = makeDependencies({
			loadCurrentPageHtml: vi.fn().mockResolvedValue(html),
		});

		await settleImagePlacement(makeAttempt(), makeImages(), dependencies);

		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ reason, status: "failed", wid: "e-3" }),
		);
	});

	it("lets a concurrently committed receipt win over a stale target failure", async () => {
		const dependencies = makeDependencies({
			findReceipt: vi
				.fn()
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ number: 6 }),
			loadCurrentPageHtml: vi
				.fn()
				.mockResolvedValue(
					pageHtml('<img data-wid="different-image" src="old.png">'),
				),
		});

		await settleImagePlacement(makeAttempt(), makeImages(), dependencies);

		expect(dependencies.pageEditsService.applyAiOps).not.toHaveBeenCalled();
		expect(dependencies.updatePlacement).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ status: "applied", versionNumber: 6 }),
		);
	});
});
