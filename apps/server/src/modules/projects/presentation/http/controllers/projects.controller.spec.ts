import type { AuthUser } from "@wandit/auth";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import type { ProjectsService } from "../../../application/services/projects.service";
import { ProjectsController } from "./projects.controller";

const user = {
	banned: false,
	createdAt: new Date("2026-10-01T00:00:00.000Z"),
	email: "user@wandit.test",
	emailVerified: true,
	id: "user_1",
	name: "User",
	role: "user",
	updatedAt: new Date("2026-10-01T00:00:00.000Z"),
} satisfies AuthUser;

const workspaces: WorkspaceContext[] = [
	{ kind: "personal" },
	{
		kind: "org",
		organizationId: "org_1",
		role: "owner",
		roles: ["owner"],
	},
];

describe("ProjectsController", () => {
	it.each(
		workspaces,
	)("rejects V1 creation in a $kind workspace before starting creation", async (workspace) => {
		const projectsService = {
			create: vi.fn<ProjectsService["create"]>().mockResolvedValue({
				chatId: "00000000-0000-4000-8000-000000000002",
				projectId: "00000000-0000-4000-8000-000000000001",
			}),
			delete: vi.fn<ProjectsService["delete"]>(),
			get: vi.fn<ProjectsService["get"]>(),
			list: vi.fn<ProjectsService["list"]>(),
			listPaged: vi.fn<ProjectsService["listPaged"]>(),
			update: vi.fn<ProjectsService["update"]>(),
		};
		const controller = new ProjectsController(projectsService);

		await expect(async () =>
			controller.create({ prompt: "Create a page" }, user, workspace),
		).rejects.toMatchObject({
			response: { code: "V1_PROJECT_CREATION_DISABLED" },
			status: 403,
		});
		expect(projectsService.create).not.toHaveBeenCalled();
	});
});
