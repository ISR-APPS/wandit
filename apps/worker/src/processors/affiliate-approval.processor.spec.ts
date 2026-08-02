import {
	AFFILIATE_APPROVAL_SWEEP_JOB,
	AFFILIATE_ATTRIBUTION_RETRY_JOB,
	type AffiliateAttributionRetryJobData,
	type AffiliateMaintenanceJobData,
	type AffiliateMaintenanceJobName,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { AffiliateApprovalService } from "../../../server/src/modules/affiliates/application/services/affiliate-approval.service";
import type { AffiliateAttributionService } from "../../../server/src/modules/affiliates/application/services/affiliate-attribution.service";
import type { AffiliateCommissionService } from "../../../server/src/modules/affiliates/application/services/affiliate-commission.service";
import { AffiliateApprovalProcessor } from "./affiliate-approval.processor";

const retryData: AffiliateAttributionRetryJobData = {
	source: "signup_cookie",
	token: "signed-affiliate-token",
	userId: "user_1",
};

function setup() {
	const approvalService = {
		sweepEligible: vi.fn(async () => ({ approved: 2 })),
	};
	const commissionService = {
		reconcilePendingAttributedCandidates: vi.fn(async () => 3),
	};
	const attributionService = {
		retryLockFromJob: vi.fn(async () => ({ attributionId: "attribution_1" })),
	};
	const queue = {
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const processor = new AffiliateApprovalProcessor(
		approvalService as unknown as AffiliateApprovalService,
		commissionService as unknown as AffiliateCommissionService,
		attributionService as unknown as AffiliateAttributionService,
		queue as unknown as Queue,
	);

	return {
		approvalService,
		attributionService,
		commissionService,
		processor,
		queue,
	};
}

function job(
	name: AffiliateMaintenanceJobName = AFFILIATE_APPROVAL_SWEEP_JOB,
	data: AffiliateMaintenanceJobData = {},
) {
	return {
		data,
		name,
	} as unknown as Job<
		AffiliateMaintenanceJobData,
		unknown,
		AffiliateMaintenanceJobName
	>;
}

describe("AffiliateApprovalProcessor", () => {
	it("upserts the daily UTC approval scheduler with bounded history", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();
		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"affiliate-approval-daily",
			{ pattern: "0 4 * * *", tz: "UTC" },
			{
				data: {},
				name: AFFILIATE_APPROVAL_SWEEP_JOB,
				opts: {
					attempts: 5,
					backoff: { delay: 60_000, type: "exponential" },
					removeOnComplete: 10,
					removeOnFail: 50,
				},
			},
		);
	});

	it("delegates the sweep job to AffiliateApprovalService", async () => {
		const { approvalService, commissionService, processor } = setup();

		await expect(processor.process(job())).resolves.toEqual({
			approved: 2,
			reconciled: 3,
		});
		expect(approvalService.sweepEligible).toHaveBeenCalledOnce();
		expect(
			commissionService.reconcilePendingAttributedCandidates,
		).toHaveBeenCalledOnce();
	});

	it("dispatches an attribution retry with its durable token source", async () => {
		const {
			approvalService,
			attributionService,
			commissionService,
			processor,
		} = setup();

		await expect(
			processor.process(job(AFFILIATE_ATTRIBUTION_RETRY_JOB, retryData)),
		).resolves.toEqual({ attributionId: "attribution_1" });
		expect(attributionService.retryLockFromJob).toHaveBeenCalledOnce();
		expect(attributionService.retryLockFromJob).toHaveBeenCalledWith(retryData);
		expect(approvalService.sweepEligible).not.toHaveBeenCalled();
		expect(
			commissionService.reconcilePendingAttributedCandidates,
		).not.toHaveBeenCalled();
	});

	it("still runs approval when candidate reconciliation needs a retry", async () => {
		const { approvalService, commissionService, processor } = setup();
		commissionService.reconcilePendingAttributedCandidates.mockRejectedValueOnce(
			new Error("candidate retry"),
		);

		await expect(processor.process(job())).rejects.toThrow("candidate retry");
		expect(approvalService.sweepEligible).toHaveBeenCalledOnce();
	});

	it("rejects unknown job names", async () => {
		const {
			approvalService,
			attributionService,
			commissionService,
			processor,
		} = setup();

		await expect(processor.process(job("unexpected" as never))).rejects.toThrow(
			"Unknown affiliate maintenance job unexpected",
		);
		expect(approvalService.sweepEligible).not.toHaveBeenCalled();
		expect(attributionService.retryLockFromJob).not.toHaveBeenCalled();
		expect(
			commissionService.reconcilePendingAttributedCandidates,
		).not.toHaveBeenCalled();
	});
});
