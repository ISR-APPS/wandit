import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { SKIP_RESPONSE_ENVELOPE_KEY } from "../../../../../infrastructure/http/skip-envelope.decorator";
import type { AdminPagePreviewService } from "../../../application/services/admin-page-preview.service";
import type { AdminProjectsService } from "../../../application/services/admin-projects.service";
import { AdminGuard } from "../guards/admin.guard";
import { AdminProjectsController } from "./admin-projects.controller";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

function setup() {
	const projectsService = {};
	const pagePreviewService = {
		versionHtml: vi.fn(),
	};
	const controller = new AdminProjectsController(
		projectsService as AdminProjectsService,
		pagePreviewService as unknown as AdminPagePreviewService,
	);

	return { controller, pagePreviewService };
}

describe("AdminProjectsController", () => {
	it("protects the complete controller with AdminGuard", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AdminProjectsController),
		).toEqual([AdminGuard]);
	});

	it("serves version HTML raw in an isolated, non-cached document", async () => {
		const { controller, pagePreviewService } = setup();
		pagePreviewService.versionHtml.mockResolvedValue({
			html: "<!doctype html><html><body>Preview</body></html>",
		});
		const reply = {
			header: vi.fn(),
			send: vi.fn(async () => undefined),
		};
		reply.header.mockReturnValue(reply);

		await controller.versionPreview(
			PROJECT_ID,
			VERSION_ID,
			reply as unknown as FastifyReply,
		);

		expect(
			Reflect.getMetadata(
				SKIP_RESPONSE_ENVELOPE_KEY,
				AdminProjectsController.prototype.versionPreview,
			),
		).toBe(true);
		expect(pagePreviewService.versionHtml).toHaveBeenCalledWith(
			PROJECT_ID,
			VERSION_ID,
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			1,
			"Content-Type",
			"text/html; charset=utf-8",
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			2,
			"Cache-Control",
			"private, no-store",
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			3,
			"Content-Security-Policy",
			"sandbox allow-forms allow-scripts; frame-ancestors 'none'",
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			4,
			"Referrer-Policy",
			"no-referrer",
		);
		expect(reply.send).toHaveBeenCalledWith(
			"<!doctype html><html><body>Preview</body></html>",
		);
	});
});
