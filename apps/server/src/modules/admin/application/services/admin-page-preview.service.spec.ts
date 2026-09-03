import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import type { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import { AdminPagePreviewService } from "./admin-page-preview.service";

vi.mock("../../../../infrastructure/storage/r2", () => ({
	getPageHtml: vi.fn(),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

function setup() {
	const adminRepository = {
		findProjectDetail: vi.fn().mockResolvedValue({
			createdAt: new Date("2026-08-01T10:00:00.000Z"),
			id: PROJECT_ID,
			name: "Landing page",
			organizationId: null,
			ownerEmail: "owner@example.com",
			ownerId: "user_1",
			ownerName: "Owner",
			updatedAt: new Date("2026-08-02T10:00:00.000Z"),
		}),
	};
	const pagesRepository = {
		findAccessibleVersionById: vi.fn(),
	};
	const service = new AdminPagePreviewService(
		adminRepository as unknown as AdminRepository,
		pagesRepository as unknown as PagesRepository,
	);

	return { adminRepository, pagesRepository, service };
}

beforeEach(() => {
	vi.mocked(getPageHtml).mockReset();
});

describe("AdminPagePreviewService", () => {
	it("returns stamped version HTML from the existing page storage path", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			artifactId: "44444444-4444-4444-8444-444444444444",
			id: VERSION_ID,
			projectId: PROJECT_ID,
			r2Key: "sites/project/version/index.html",
		});
		vi.mocked(getPageHtml).mockResolvedValue(
			'<!doctype html><html><body><section data-wid="hero"><span>Preview</span></section></body></html>',
		);

		const result = await service.versionHtml(PROJECT_ID, VERSION_ID);

		expect(result.html).toMatch(/<span data-wid="e-\d+">Preview<\/span>/);
		expect(getPageHtml).toHaveBeenCalledWith(
			"sites/project/version/index.html",
		);
	});

	it("404s when the version belongs to a different project", async () => {
		const { pagesRepository, service } = setup();
		pagesRepository.findAccessibleVersionById.mockResolvedValue({
			artifactId: "44444444-4444-4444-8444-444444444444",
			id: VERSION_ID,
			projectId: OTHER_PROJECT_ID,
			r2Key: "sites/other-project/version/index.html",
		});

		await expect(
			service.versionHtml(PROJECT_ID, VERSION_ID),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(getPageHtml).not.toHaveBeenCalled();
	});
});
