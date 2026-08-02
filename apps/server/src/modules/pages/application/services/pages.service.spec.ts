import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../infrastructure/persistence/pages.repository";
import { PagesService } from "./pages.service";

// R2 is a network dependency — replace the storage module so tests control
// what "the bucket" returns without credentials.
vi.mock("../../../../infrastructure/storage/r2", () => ({
	getPageHtml: vi.fn(),
}));

vi.mock("../../../../infrastructure/analytics/analytics.service", () => ({
	AnalyticsService: class AnalyticsService {},
}));

function setup() {
	const pagesRepository = {
		findOverviewByProject: vi.fn(),
		findOwnedVersionById: vi.fn(),
		listVersionsForProject: vi.fn(),
	};
	const service = new PagesService(
		pagesRepository as unknown as PagesRepository,
	);

	return { pagesRepository, service };
}

beforeEach(() => {
	vi.mocked(getPageHtml).mockReset();
});

describe("PagesService", () => {
	it("maps overview rows to the contract shape with ISO dates", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOverviewByProject.mockResolvedValue({
			activeVersion: {
				createdAt: new Date("2026-07-11T10:00:00.000Z"),
				id: "22222222-2222-4222-8222-222222222222",
				number: 3,
			},
			artifactId: "11111111-1111-4111-8111-111111111111",
			latestAttempt: {
				createdAt: new Date("2026-07-11T11:00:00.000Z"),
				error: null,
				id: "33333333-3333-4333-8333-333333333333",
				status: "generating" as const,
				versionId: null,
			},
		});

		await expect(service.overview("user_1", "project_1")).resolves.toEqual({
			activeVersion: {
				createdAt: "2026-07-11T10:00:00.000Z",
				id: "22222222-2222-4222-8222-222222222222",
				number: 3,
			},
			artifactId: "11111111-1111-4111-8111-111111111111",
			latestAttempt: {
				createdAt: "2026-07-11T11:00:00.000Z",
				error: null,
				id: "33333333-3333-4333-8333-333333333333",
				status: "generating",
				versionId: null,
			},
		});
	});

	it("404s the overview when the project is not owned", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOverviewByProject.mockResolvedValue(null);

		await expect(
			service.overview("user_1", "project_x"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("returns the version html from storage", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOwnedVersionById.mockResolvedValue({
			id: "44444444-4444-4444-8444-444444444444",
			r2Key: "sites/project_1/version_1/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(
			'<!doctype html><html><body><section data-wid="hero"><span>Price: <em>now</em></span></section></body></html>',
		);

		const response = await service.versionHtml("user_1", "version_1");

		expect(response.versionId).toBe("44444444-4444-4444-8444-444444444444");
		expect(response.html).toMatch(
			/<span data-wid="e-\d+">Price: <em>now<\/em><\/span>/,
		);
		expect(getPageHtml).toHaveBeenCalledWith(
			"sites/project_1/version_1/index.html",
		);
	});

	it("maps valid version sources and defaults legacy or invalid metadata to null", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.listVersionsForProject.mockResolvedValue([
			{
				createdAt: new Date("2026-07-31T10:00:00.000Z"),
				id: "11111111-1111-4111-8111-111111111111",
				isLive: false,
				meta: { source: "builder" },
				number: 3,
			},
			{
				createdAt: new Date("2026-07-31T09:00:00.000Z"),
				id: "22222222-2222-4222-8222-222222222222",
				isLive: false,
				meta: { source: "unknown" },
				number: 2,
			},
			{
				createdAt: new Date("2026-07-31T08:00:00.000Z"),
				id: "33333333-3333-4333-8333-333333333333",
				isLive: true,
				meta: {},
				number: 1,
			},
		]);

		const response = await service.listVersions("user_1", "project_1");

		expect(response.versions.map((version) => version.source)).toEqual([
			"builder",
			null,
			null,
		]);
		expect(response.versions.map((version) => version.isBuilderOrigin)).toEqual(
			[true, false, true],
		);
	});

	it("404s the version html when the version is unknown or not owned", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOwnedVersionById.mockResolvedValue(null);

		await expect(
			service.versionHtml("user_1", "version_x"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});

	it("404s the version html when the object is missing in storage", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findOwnedVersionById.mockResolvedValue({
			id: "44444444-4444-4444-8444-444444444444",
			r2Key: "sites/project_1/version_1/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(null);

		await expect(
			service.versionHtml("user_1", "version_1"),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
