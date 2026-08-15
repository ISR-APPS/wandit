import { GUARDS_METADATA } from "@nestjs/common/constants";
import type {
	AdminListAcademyGuidesQuery,
	CreateAcademyGuideInput,
	UpdateAcademyGuideInput,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import type { AcademyService } from "../../../application/services/academy.service";
import { AcademyAdminController } from "./academy-admin.controller";

const GUIDE_ID = "11111111-1111-4111-8111-111111111111";

function setup() {
	const service = {
		adminList: vi.fn(),
		adminGetById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
	const controller = new AcademyAdminController(
		service as unknown as AcademyService,
	);

	return { controller, service };
}

describe("AcademyAdminController", () => {
	it("protects the complete controller with the admin auth surface and guard", () => {
		expect(Reflect.getMetadata(AUTH_SURFACE_KEY, AcademyAdminController)).toBe(
			ADMIN_AUTH_SURFACE,
		);
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AcademyAdminController),
		).toEqual([AdminGuard]);
	});

	it("derives guide ownership from the authenticated admin", async () => {
		const { controller, service } = setup();
		const input: CreateAcademyGuideInput = {
			title: "Video lesson",
			youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
			bodyHtml: "",
		};

		await controller.create(input, { id: "admin_1" } as never);

		expect(service.create).toHaveBeenCalledWith(input, "admin_1");
	});

	it("wires list, detail, update, and delete to the Academy service", async () => {
		const { controller, service } = setup();
		const query: AdminListAcademyGuidesQuery = {
			page: 2,
			pageSize: 10,
			q: "launch",
			status: "published",
		};
		const patch: UpdateAcademyGuideInput = {
			bodyHtml: "<p>Updated guide</p>",
		};

		await controller.list(query);
		await controller.guide(GUIDE_ID);
		await controller.update(GUIDE_ID, patch);
		await controller.delete(GUIDE_ID);

		expect(service.adminList).toHaveBeenCalledWith(query);
		expect(service.adminGetById).toHaveBeenCalledWith(GUIDE_ID);
		expect(service.update).toHaveBeenCalledWith(GUIDE_ID, patch);
		expect(service.delete).toHaveBeenCalledWith(GUIDE_ID);
	});
});
