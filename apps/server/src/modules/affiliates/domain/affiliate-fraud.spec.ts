import { describe, expect, it } from "vitest";

import {
	affiliateCommissionCanApprove,
	appendAffiliateFraudFlag,
} from "./affiliate-fraud";

const now = new Date("2026-08-02T12:00:00.000Z");

describe("affiliate fraud policy", () => {
	it("excludes voided and unresolved-flag attributions from approval", () => {
		const base = {
			attributionStatus: "active" as const,
			candidateStatus: "processed" as const,
			fraudFlags: [],
			holdUntil: new Date("2026-08-01T12:00:00.000Z"),
			status: "pending" as const,
		};
		const flag = appendAffiliateFraudFlag([], "self_referral_email", now);

		expect(affiliateCommissionCanApprove(base, now)).toBe(true);
		expect(
			affiliateCommissionCanApprove(
				{ ...base, attributionStatus: "voided" },
				now,
			),
		).toBe(false);
		expect(
			affiliateCommissionCanApprove({ ...base, fraudFlags: flag }, now),
		).toBe(false);
		expect(
			affiliateCommissionCanApprove(
				{ ...base, candidateStatus: "pending_attribution" },
				now,
			),
		).toBe(false);
	});

	it("allows a resolved flag but not an unexpired hold", () => {
		const resolved = [
			{
				code: "self_referral_user_id",
				detectedAt: "2026-07-01T00:00:00.000Z",
				resolvedAt: "2026-07-02T00:00:00.000Z",
				resolvedByUserId: "admin_1",
			},
		];

		expect(
			affiliateCommissionCanApprove(
				{
					attributionStatus: "active",
					candidateStatus: "processed",
					fraudFlags: resolved,
					holdUntil: now,
					status: "pending",
				},
				now,
			),
		).toBe(true);
		expect(
			affiliateCommissionCanApprove(
				{
					attributionStatus: "active",
					candidateStatus: "processed",
					fraudFlags: resolved,
					holdUntil: new Date(now.getTime() + 1),
					status: "pending",
				},
				now,
			),
		).toBe(false);
	});
});
