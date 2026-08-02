import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	AFFILIATE_APPROVAL_SWEEP_JOB,
	AFFILIATE_ATTRIBUTION_RETRY_JOB,
	AFFILIATE_MAINTENANCE_QUEUE,
	type AffiliateAttributionRetryJobData,
	type AffiliateMaintenanceJobData,
	type AffiliateMaintenanceJobName,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { AffiliateApprovalService } from "../../../server/src/modules/affiliates/application/services/affiliate-approval.service";
import { AffiliateAttributionService } from "../../../server/src/modules/affiliates/application/services/affiliate-attribution.service";
import { AffiliateCommissionService } from "../../../server/src/modules/affiliates/application/services/affiliate-commission.service";

const AFFILIATE_APPROVAL_SCHEDULER = "affiliate-approval-daily";

@Processor(AFFILIATE_MAINTENANCE_QUEUE)
export class AffiliateApprovalProcessor
	extends WorkerHost
	implements OnModuleInit
{
	private readonly logger = new Logger(AffiliateApprovalProcessor.name);

	constructor(
		@Inject(AffiliateApprovalService)
		private readonly approvalService: AffiliateApprovalService,
		@Inject(AffiliateCommissionService)
		private readonly commissionService: AffiliateCommissionService,
		@Inject(AffiliateAttributionService)
		private readonly attributionService: AffiliateAttributionService,
		@InjectQueue(AFFILIATE_MAINTENANCE_QUEUE)
		private readonly queue: Queue<AffiliateMaintenanceJobData, unknown, string>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			AFFILIATE_APPROVAL_SCHEDULER,
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
		this.logger.log("Affiliate commission approval scheduler registered");
	}

	async process(
		job: Job<AffiliateMaintenanceJobData, unknown, AffiliateMaintenanceJobName>,
	) {
		if (job.name === AFFILIATE_ATTRIBUTION_RETRY_JOB) {
			return this.attributionService.retryLockFromJob(
				job.data as AffiliateAttributionRetryJobData,
			);
		}

		if (job.name !== AFFILIATE_APPROVAL_SWEEP_JOB) {
			throw new Error(
				`Unknown affiliate maintenance job ${job.name satisfies never}`,
			);
		}

		let reconciliationError: unknown;
		let reconciled = 0;

		try {
			reconciled =
				await this.commissionService.reconcilePendingAttributedCandidates();
		} catch (error) {
			reconciliationError = error;
		}

		const { approved } = await this.approvalService.sweepEligible();

		if (reconciliationError) {
			throw reconciliationError;
		}

		return { approved, reconciled };
	}
}
