import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import type { StoryLinkAdminService } from "../../../application/services/story-link-admin.service";
import { StoryLinkAdminController } from "./story-link-admin.controller";

function setup() {
	const service = {
		create: vi.fn(),
		list: vi.fn(),
		update: vi.fn(),
	};
	const controller = new StoryLinkAdminController(
		service as unknown as StoryLinkAdminService,
	);

	return { controller, service };
}

describe("StoryLinkAdminController", () => {
	it("requires admin-session authentication and authorization", () => {
		expect(
			Reflect.getMetadata(AUTH_SURFACE_KEY, StoryLinkAdminController),
		).toBe(ADMIN_AUTH_SURFACE);
		expect(
			Reflect.getMetadata(GUARDS_METADATA, StoryLinkAdminController),
		).toEqual([AdminGuard]);
	});

	it("delegates list, create, and update requests", async () => {
		const { controller, service } = setup();
		const query = { range: "30d" } as const;
		const createInput = {
			name: "Summer story",
			slug: "summer-story",
			utmCampaign: "summer-story",
			utmMedium: "story",
			utmSource: "instagram",
		};
		const updateInput = { archived: true, name: "Archived summer story" };

		await controller.list(query);
		await controller.create(createInput);
		await controller.update(
			"22222222-2222-4222-8222-222222222222",
			updateInput,
		);

		expect(service.list).toHaveBeenCalledWith(query);
		expect(service.create).toHaveBeenCalledWith(createInput);
		expect(service.update).toHaveBeenCalledWith(
			"22222222-2222-4222-8222-222222222222",
			updateInput,
		);
	});
});
