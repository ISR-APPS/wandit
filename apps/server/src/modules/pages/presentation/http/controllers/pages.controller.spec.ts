import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import type { PageEditsService } from "../../../application/services/page-edits.service";
import type { PagesService } from "../../../application/services/pages.service";
import { PagesController } from "./pages.controller";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const ACTIVE_VERSION_ID = "33333333-3333-4333-8333-333333333333";

function setup() {
	const pagesService = {
		listVersions: vi.fn(),
		overview: vi.fn(),
		versionHtml: vi.fn(),
	};
	const pageEditsService = {
		applyClientOps: vi.fn(),
		restoreVersion: vi.fn(),
	};
	const controller = new PagesController(
		pagesService as unknown as PagesService,
		pageEditsService as unknown as PageEditsService,
	);

	return { controller, pageEditsService };
}

const user = {
	id: "user_1",
} as Parameters<PagesController["restoreVersion"]>[3];

const workspace = { kind: "personal" } as WorkspaceContext;

describe("PagesController.restoreVersion", () => {
	it("delegates a copy-forward restore with the authenticated user", async () => {
		const { controller, pageEditsService } = setup();
		const response = {
			version: {
				createdAt: "2026-07-31T10:30:00.000Z",
				id: "44444444-4444-4444-8444-444444444444",
				number: 4,
			},
		};
		pageEditsService.restoreVersion.mockResolvedValue(response);

		await expect(
			controller.restoreVersion(
				PROJECT_ID,
				VERSION_ID,
				{ expectedActiveVersionId: ACTIVE_VERSION_ID },
				user,
				workspace,
			),
		).resolves.toEqual(response);
		expect(pageEditsService.restoreVersion).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			PROJECT_ID,
			VERSION_ID,
			{ expectedActiveVersionId: ACTIVE_VERSION_ID },
		);
	});

	it.each([
		new ConflictException({
			activeVersionId: ACTIVE_VERSION_ID,
			code: "VERSION_CONFLICT",
		}),
		new NotFoundException(),
	])("preserves service HTTP errors", async (error) => {
		const { controller, pageEditsService } = setup();
		pageEditsService.restoreVersion.mockRejectedValue(error);

		await expect(
			controller.restoreVersion(
				PROJECT_ID,
				VERSION_ID,
				{ expectedActiveVersionId: ACTIVE_VERSION_ID },
				user,
				workspace,
			),
		).rejects.toBe(error);
	});
});
