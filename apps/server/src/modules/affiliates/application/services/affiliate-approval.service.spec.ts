import { describe, expect, it, vi } from "vitest";

import type { AffiliatesRepository } from "../../infrastructure/persistence/affiliates.repository";
import { AffiliateApprovalService } from "./affiliate-approval.service";

function setup() {
	const affiliatesRepository = {
		approveEligible: vi.fn(async () => 3),
	};
	const service = new AffiliateApprovalService(
		affiliatesRepository as unknown as AffiliatesRepository,
	);

	return { affiliatesRepository, service };
}

describe("AffiliateApprovalService", () => {
	it("returns the number of commissions approved by the repository sweep", async () => {
		const { affiliatesRepository, service } = setup();

		await expect(service.sweepEligible()).resolves.toEqual({ approved: 3 });
		expect(affiliatesRepository.approveEligible).toHaveBeenCalledOnce();
		expect(affiliatesRepository.approveEligible).toHaveBeenCalledWith();
	});

	it("propagates repository failures so BullMQ can retry the sweep", async () => {
		const { affiliatesRepository, service } = setup();
		affiliatesRepository.approveEligible.mockRejectedValueOnce(
			new Error("database unavailable"),
		);

		await expect(service.sweepEligible()).rejects.toThrow(
			"database unavailable",
		);
	});
});
