import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { SKIP_RESPONSE_ENVELOPE_KEY } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import type { AffiliateAdminService } from "../../../application/services/affiliate-admin.service";
import { AffiliateAdminController } from "./affiliate-admin.controller";

const AFFILIATE_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";

function setup() {
	const service = {
		buildPayout: vi.fn(),
		exportAffiliates: vi.fn(),
	};
	const controller = new AffiliateAdminController(
		service as unknown as AffiliateAdminService,
	);

	return { controller, service };
}

describe("AffiliateAdminController", () => {
	it("protects the complete controller with AdminGuard", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AffiliateAdminController),
		).toEqual([AdminGuard]);
	});

	it("derives payout ownership from the authenticated admin", async () => {
		const { controller, service } = setup();
		const input = {
			affiliateId: AFFILIATE_ID,
			currency: "usd",
			requestId: REQUEST_ID,
		};
		service.buildPayout.mockResolvedValue({ payout: { id: "payout_1" } });

		await controller.buildPayout(input, { id: "admin_1" } as never);

		expect(service.buildPayout).toHaveBeenCalledWith(input, "admin_1");
	});

	it("serves CSV raw with private no-store headers", async () => {
		const { controller, service } = setup();
		service.exportAffiliates.mockResolvedValue({
			fileName: "affiliates.csv",
			content: "affiliate_id\r\n",
		});
		const reply = {
			header: vi.fn(),
			send: vi.fn(async () => undefined),
		};
		reply.header.mockReturnValue(reply);

		await controller.exportCsv({}, reply as unknown as FastifyReply);

		expect(
			Reflect.getMetadata(
				SKIP_RESPONSE_ENVELOPE_KEY,
				AffiliateAdminController.prototype.exportCsv,
			),
		).toBe(true);
		expect(reply.header).toHaveBeenNthCalledWith(
			1,
			"Content-Type",
			"text/csv; charset=utf-8",
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			2,
			"Content-Disposition",
			'attachment; filename="affiliates.csv"',
		);
		expect(reply.header).toHaveBeenNthCalledWith(
			3,
			"Cache-Control",
			"private, no-store",
		);
		expect(reply.send).toHaveBeenCalledWith("affiliate_id\r\n");
	});
});
