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
