import { Inject, Injectable, Logger } from "@nestjs/common";

import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import { captureGenerationCompleted } from "../../../../infrastructure/analytics/generation-events";
import { createConnectorGenerationBilling } from "../../../mcp-connectors/application/services/connector-generation-billing";
import { connectorGenerationPlan } from "../../../mcp-connectors/domain/connector-generation-metering";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { extractMediaUrls } from "../../domain/extract-media-urls";
import {
	type ConnectorGenerationAttemptRow,
	ConnectorGenerationsRepository,
} from "../../infrastructure/persistence/connector-generations.repository";

export type ConnectorCompletionRecoveryOutcome = {
	failed: number;
	recovered: number;
	scanned: number;
};

/**
 * Publishes provider-complete connector rows whose Trigger process died after
 * writing the media checkpoint. Billing is repaired before the running row is
 * made visible as succeeded; every write is replay-safe.
 */
@Injectable()
export class ConnectorGenerationRecoveryService {
	private readonly logger = new Logger(ConnectorGenerationRecoveryService.name);

	constructor(
		@Inject(ConnectorGenerationsRepository)
		private readonly repository: ConnectorGenerationsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async recoverCompletionCheckpoints(
		limit = 100,
	): Promise<ConnectorCompletionRecoveryOutcome> {
		const rows = await this.repository.listRunningCompletionCheckpoints(limit);
		const outcome: ConnectorCompletionRecoveryOutcome = {
			failed: 0,
			recovered: 0,
			scanned: rows.length,
		};

		for (const row of rows) {
			try {
				if (await this.recoverCheckpoint(row)) {
					outcome.recovered += 1;
				}
			} catch (error) {
				outcome.failed += 1;
				this.logger.error(
					`Connector completion recovery failed for ${row.id}`,
					error instanceof Error ? error.stack : String(error),
				);
			}
		}

		return outcome;
	}

	async recoverCheckpoint(
		row: ConnectorGenerationAttemptRow,
	): Promise<boolean> {
		if (row.status !== "running" || row.media === null) {
			return false;
		}

		const plan = connectorGenerationPlan(row.toolName, row.args);
		if (!plan) {
			throw new Error(
				`Connector attempt ${row.id} has no generation billing plan`,
			);
		}

		const media = extractMediaUrls(row.media);
		const childUnits = completedChildUnits(plan, media);
		const billing = createConnectorGenerationBilling({
			// Existing event ids are the durable admission snapshot. Recovery only
			// looks them up; it never creates a hold from the runtime kill switch.
			isBillingDisabled: () => true,
			meteringService: this.meteringService,
		});

		await billing.settleExisting(attemptSubject(row), row.id, {
			...plan,
			childOperation: plan.childOperation,
			completedChildUnits: childUnits,
		});

		const completed = await this.repository.markRunningAttemptSucceeded(row.id);
		if (completed) {
			captureGenerationCompleted(
				this.analyticsService,
				row.userId,
				"connector",
				null,
				row.id,
			);
		}

		return completed;
	}
}

function completedChildUnits(
	plan: NonNullable<ReturnType<typeof connectorGenerationPlan>>,
	media: ReturnType<typeof extractMediaUrls>,
): number | undefined {
	if (!plan.childOperation) {
		return undefined;
	}

	if (plan.childOperation === "video") {
		return 1;
	}

	const imageCount = media.filter((item) => item.kind === "image").length;
	return Math.min(plan.childUnits ?? 1, imageCount);
}

/** The payer snapshotted when the attempt was queued. */
function attemptSubject(row: {
	organizationId: string | null;
	userId: string;
}): MeteringSubject {
	return {
		actorUserId: row.userId,
		...(row.organizationId ? { organizationId: row.organizationId } : {}),
	};
}
