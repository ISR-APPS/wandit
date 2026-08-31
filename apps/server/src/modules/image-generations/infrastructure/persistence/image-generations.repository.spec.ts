import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../../../infrastructure/database/database.constants";

const aiErrorMocks = vi.hoisted(() => ({
	captureAiError: vi.fn(() => "image-sentry-event"),
}));

vi.mock("../../../ai-errors/domain", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../ai-errors/domain")>()),
	captureAiError: aiErrorMocks.captureAiError,
}));

import { ImageGenerationsRepository } from "./image-generations.repository";

type SqlCondition = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

function compileCondition(condition: unknown) {
	if (
		typeof condition !== "object" ||
		condition === null ||
		!("toQuery" in condition) ||
		typeof condition.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL condition");
	}

	const { params, sql } = (condition as SqlCondition).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function repositoryWithPlacementUpdate() {
	const where = vi.fn().mockResolvedValue(undefined);
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	const repository = new ImageGenerationsRepository(
		{ update } as unknown as Database,
		{ capture: vi.fn() },
	);

	return { repository, where };
}

function repositoryWithProgressUpdate(updated = true) {
	const returning = vi
		.fn()
		.mockResolvedValue(updated ? [{ id: "attempt-1" }] : []);
	const where = vi.fn((_condition: unknown) => ({ returning }));
	const set = vi.fn(() => ({ where }));
	const update = vi.fn(() => ({ set }));
	const repository = new ImageGenerationsRepository(
		{ update } as unknown as Database,
		{ capture: vi.fn() },
	);

	return { repository, set, where };
}

function repositoryWithGeneratedSourceLookup(
	images: Array<{ mediaType: string; url: string }> | null,
) {
	const limit = vi.fn().mockResolvedValue(images ? [{ images }] : []);
	const where = vi.fn((_condition: unknown) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const repository = new ImageGenerationsRepository(
		{ select } as unknown as Database,
		{ capture: vi.fn() },
	);

	return { repository, where };
}

describe("ImageGenerationsRepository.findSucceededImageByUrlForProject", () => {
	it("scopes the exact recorded URL to a succeeded attempt in the project", async () => {
		const requestedUrl = "https://assets.example.com/images/project-1/item.png";
		const authoritative = { mediaType: "image/png", url: requestedUrl };
		const { repository, where } = repositoryWithGeneratedSourceLookup([
			{ mediaType: "image/jpeg", url: "https://assets.example.com/other.jpg" },
			authoritative,
		]);

		await expect(
			repository.findSucceededImageByUrlForProject("project-1", requestedUrl),
		).resolves.toEqual(authoritative);

		const condition = compileCondition(where.mock.calls[0]?.[0]);
		expect(condition.params).toEqual(["project-1", "succeeded", requestedUrl]);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."project_id" = $1`,
		);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."status" = $2`,
		);
		expect(condition.sql).toContain("jsonb_array_elements");
		expect(condition.sql).toContain("image_ref->>'url' = $3");
	});

	it("does not authorize a URL absent from the selected row", async () => {
		const { repository } = repositoryWithGeneratedSourceLookup([
			{ mediaType: "image/png", url: "https://assets.example.com/other.png" },
		]);

		await expect(
			repository.findSucceededImageByUrlForProject(
				"project-1",
				"https://assets.example.com/missing.png",
			),
		).resolves.toBeNull();
	});
});

describe("ImageGenerationsRepository.persistProgress", () => {
	it("writes indexed progress only while the attempt is generating", async () => {
		const { repository, set, where } = repositoryWithProgressUpdate();
		const images = [
			{
				index: 3,
				mediaType: "image/png",
				url: "https://assets.example.com/img-3.png",
			},
		];

		await expect(
			repository.persistProgress("attempt-1", "project-1", images),
		).resolves.toBe(true);
		expect(set).toHaveBeenCalledWith({ images });

		const condition = compileCondition(where.mock.calls[0]?.[0]);
		expect(condition.params).toEqual(["attempt-1", "project-1", "generating"]);
	});

	it("reports a lost status guard", async () => {
		const { repository } = repositoryWithProgressUpdate(false);

		await expect(
			repository.persistProgress("attempt-1", "project-1", []),
		).resolves.toBe(false);
	});
});

describe("ImageGenerationsRepository.markAttemptFailed", () => {
	it("does not capture when the queued-to-failed CAS loses", async () => {
		const returning = vi.fn().mockResolvedValue([]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const repository = new ImageGenerationsRepository(
			{ update: vi.fn(() => ({ set })) } as unknown as Database,
			{ capture: vi.fn() },
		);
		aiErrorMocks.captureAiError.mockClear();

		await expect(
			repository.markAttemptFailed(
				"attempt-1",
				"stale",
				"user-1",
				"stale_queued",
			),
		).resolves.toBe(false);

		expect(aiErrorMocks.captureAiError).not.toHaveBeenCalled();
	});

	it("stores an internal normalized failure while preserving the analytics reason", async () => {
		const returning = vi.fn().mockResolvedValue([{ projectId: "project-1" }]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const analytics = { capture: vi.fn() };
		const repository = new ImageGenerationsRepository(
			{ update } as unknown as Database,
			analytics,
		);

		await expect(
			repository.markAttemptFailed(
				"attempt-1",
				"The background generator rejected this request. Please try again.",
				"user-1",
				"trigger_rejected",
			),
		).resolves.toBe(true);

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				error:
					"The background generator rejected this request. Please try again.",
				failureKind: "internal",
				failureProvider: null,
				failureProviderMessage: null,
				failureRequestId: null,
				failureSource: "ours",
				sentryEventId: null,
				status: "failed",
			}),
		);
		expect(set).toHaveBeenCalledWith({
			sentryEventId: "image-sentry-event",
		});
		expect(analytics.capture).toHaveBeenCalledWith(
			"user-1",
			"generation_failed",
			expect.objectContaining({ reason: "trigger_rejected" }),
		);
	});
});

describe("ImageGenerationsRepository.updatePlacement", () => {
	it("guards failed settlement by succeeded attempt and pending placement", async () => {
		const { repository, where } = repositoryWithPlacementUpdate();

		await repository.updatePlacement("attempt-1", "project-1", {
			imageIndex: 1,
			kind: "image-src",
			reason: "page target unavailable",
			status: "failed",
			wid: "hero-image",
		});

		const condition = compileCondition(where.mock.calls[0]?.[0]);

		expect(condition.params).toEqual(["attempt-1", "project-1", "succeeded"]);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."status" = $3`,
		);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."spec"->'placement'->>'status' = 'pending'`,
		);
		expect(condition.sql).not.toContain("exists");
	});

	it("allows applied settlement from pending or an immutable placement receipt", async () => {
		const { repository, where } = repositoryWithPlacementUpdate();

		await repository.updatePlacement("attempt-1", "project-1", {
			imageIndex: 1,
			kind: "image-src",
			status: "applied",
			versionNumber: 7,
			wid: "hero-image",
		});

		const condition = compileCondition(where.mock.calls[0]?.[0]);

		expect(condition.params).toEqual([
			"attempt-1",
			"project-1",
			"succeeded",
			"project-1",
			"attempt-1",
		]);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."status" = $3`,
		);
		expect(condition.sql).toContain(
			`"image_generation_attempts"."spec"->'placement'->>'status' = 'pending' or exists`,
		);
		expect(condition.sql).toContain(
			`from "versions" where "versions"."project_id" = $4`,
		);
		expect(condition.sql).toContain(`"versions"."meta"->>'source' = 'ai-edit'`);
		expect(condition.sql).toContain(
			`"versions"."meta"->'receipt'->>'kind' = 'image-generation-placement'`,
		);
		expect(condition.sql).toContain(
			`"versions"."meta"->'receipt'->>'attemptId' = $5`,
		);
	});
});
