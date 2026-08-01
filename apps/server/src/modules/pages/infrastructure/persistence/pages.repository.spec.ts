import { describe, expect, it, vi } from "vitest";
import type { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import type { Database } from "../../../../infrastructure/database/database.constants";

import { PagesRepository } from "./pages.repository";

function repositoryWithVersions(
	rows: Array<{ id: string; meta: unknown; r2Key: string }>,
) {
	const orderBy = vi.fn().mockResolvedValue(rows);
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const analytics = { capture: vi.fn() };
	const repository = new PagesRepository(
		{ select } as unknown as Database,
		analytics as unknown as AnalyticsService,
	);

	return { repository, select };
}

function repositoryWithReceipt(row: { number: number } | null) {
	const limit = vi.fn().mockResolvedValue(row ? [row] : []);
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const innerJoin = vi.fn(() => ({ where }));
	const from = vi.fn(() => ({ innerJoin }));
	const select = vi.fn(() => ({ from }));
	const repository = new PagesRepository({ select } as unknown as Database, {
		capture: vi.fn(),
	});

	return { limit, repository };
}

describe("PagesRepository.findLatestBuilderVersion", () => {
	it("skips newer edit rows and returns the newest explicit builder row", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v5", meta: { source: "theme" }, r2Key: "theme" },
			{ id: "v4", meta: { source: "restore" }, r2Key: "restore" },
			{ id: "v3", meta: { source: "ai-edit" }, r2Key: "ai" },
			{ id: "v2", meta: { source: "builder" }, r2Key: "builder-new" },
			{ id: "v1", meta: { source: "builder" }, r2Key: "builder-old" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toEqual({ id: "v2", r2Key: "builder-new" });
	});

	it("treats absent or null source metadata as legacy builder origin", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v4", meta: { source: "inline" }, r2Key: "inline" },
			{ id: "v3", meta: { source: "invalid" }, r2Key: "invalid" },
			{ id: "v2", meta: {}, r2Key: "legacy" },
			{ id: "v1", meta: { source: "builder" }, r2Key: "builder" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toEqual({ id: "v2", r2Key: "legacy" });
	});

	it("returns null when no builder-origin row exists", async () => {
		const { repository } = repositoryWithVersions([
			{ id: "v2", meta: { source: "theme" }, r2Key: "theme" },
			{ id: "v1", meta: { source: "ai-edit" }, r2Key: "ai" },
		]);

		await expect(
			repository.findLatestBuilderVersion("artifact-1"),
		).resolves.toBeNull();
	});
});

describe("PagesRepository.findAiEditVersionByReceipt", () => {
	it("returns the historical placement version", async () => {
		const { limit, repository } = repositoryWithReceipt({ number: 7 });

		await expect(
			repository.findAiEditVersionByReceipt("project-1", "attempt-1"),
		).resolves.toEqual({ number: 7 });
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("returns null when no placement receipt exists", async () => {
		const { repository } = repositoryWithReceipt(null);

		await expect(
			repository.findAiEditVersionByReceipt("project-1", "attempt-1"),
		).resolves.toBeNull();
	});
});

describe("PagesRepository.insertVersionAndActivate placement receipt", () => {
	it("returns the original version under the artifact lock without inserting", async () => {
		const locked = vi
			.fn()
			.mockResolvedValue([{ activeVersionId: "newer-active-version" }]);
		const artifactLimit = vi.fn(() => ({ for: locked }));
		const receiptLimit = vi.fn().mockResolvedValue([
			{
				createdAt: new Date("2026-08-01T12:00:00.000Z"),
				id: "original-placement-version",
				number: 7,
			},
		]);
		const receiptOrderBy = vi.fn(() => ({ limit: receiptLimit }));
		const select = vi
			.fn()
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: artifactLimit })),
				})),
			})
			.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ orderBy: receiptOrderBy })),
				})),
			});
		const tx = {
			insert: vi.fn(),
			select,
			update: vi.fn(),
		};
		const transaction = vi.fn(
			(callback: (transactionTx: typeof tx) => unknown) => callback(tx),
		);
		const repository = new PagesRepository(
			{ transaction } as unknown as Database,
			{ capture: vi.fn() },
		);

		await expect(
			repository.insertVersionAndActivate({
				artifactId: "artifact-1",
				expectedActiveVersionId: "older-active-version",
				meta: {
					receipt: {
						attemptId: "attempt-1",
						kind: "image-generation-placement",
					},
					source: "ai-edit",
				},
				projectId: "project-1",
				receipt: {
					attemptId: "attempt-1",
					kind: "image-generation-placement",
				},
				r2Key: "pages/duplicate.html",
				versionId: "duplicate-version",
			}),
		).resolves.toEqual({
			createdAt: new Date("2026-08-01T12:00:00.000Z"),
			existingVersionId: "original-placement-version",
			number: 7,
		});

		expect(locked).toHaveBeenCalledWith("update");
		expect(receiptLimit).toHaveBeenCalledWith(1);
		expect(tx.insert).not.toHaveBeenCalled();
		expect(tx.update).not.toHaveBeenCalled();
	});
});
