import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	METERING_QUEUE,
	METERING_RECONCILE_EVENT_JOB,
	METERING_RECOVERY_SWEEP_JOB,
	type MeteringJobData,
	type MeteringJobName,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { ConnectorGenerationRecoveryService } from "../../../server/src/modules/connector-generations/application/services/connector-generation-recovery.service";
import { MeteringService } from "../../../server/src/modules/metering/application/services/metering.service";
import { GatewayUsagePendingError } from "../../../server/src/modules/metering/domain/metering";

const METERING_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
// Background connector jobs can wait up to 5 minutes before starting and then
// run for 30 minutes. Forty minutes avoids refunding that 35-minute boundary
// while leaving five minutes of recovery grace for delayed completion writes.
const METERING_RESERVATION_STALE_AFTER_MS = 40 * 60 * 1000;
const METERING_RECONCILIATION_STALE_AFTER_MS = 60 * 1000;

@Processor(METERING_QUEUE)
export class MeteringProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(MeteringProcessor.name);

	constructor(
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(ConnectorGenerationRecoveryService)
		private readonly connectorRecovery: ConnectorGenerationRecoveryService,
		@InjectQueue(METERING_QUEUE)
		private readonly queue: Queue<MeteringJobData, unknown, MeteringJobName>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			METERING_RECOVERY_SWEEP_JOB,
			{ every: METERING_RECOVERY_INTERVAL_MS },
			{
				data: {},
				name: METERING_RECOVERY_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("AI usage recovery scheduler registered");
	}

	async process(job: Job<MeteringJobData, unknown, MeteringJobName>) {
		if (job.name === METERING_RECOVERY_SWEEP_JOB) {
			// Connector rows checkpoint provider output before settlement. Repair
			// those parent/child holds before the generic stale sweep can refund a
			// ref-less connector parent.
			const connectors =
				await this.connectorRecovery.recoverCompletionCheckpoints();
			const [reservations, settled] = await Promise.all([
				this.meteringService.recoverStaleReservations(
					new Date(Date.now() - METERING_RESERVATION_STALE_AFTER_MS),
				),
				this.meteringService.recoverUnreconciledSettled(
					new Date(Date.now() - METERING_RECONCILIATION_STALE_AFTER_MS),
				),
			]);

			return { connectors, reservations, settled };
		}

		if (job.name === METERING_RECONCILE_EVENT_JOB) {
			const eventId = this.reconcileEventId(job.data);

			try {
				return await this.meteringService.reconcile(eventId);
			} catch (error) {
				if (error instanceof GatewayUsagePendingError) {
					if (this.hasAttemptsRemaining(job)) {
						throw error;
					}

					const terminal =
						await this.meteringService.terminalizeReconciliationFailure(
							eventId,
						);

					return { eventId, status: terminal.status };
				}

				// Do not burn all BullMQ attempts on a terminal provider/schema
				// error. Persist the terminal state even when the failure happened
				// after the gateway request (for example while parsing its cost).
				this.logger.error(
					`AI usage reconciliation failed for ${eventId}`,
					error instanceof Error ? error.stack : String(error),
				);
				const terminal =
					await this.meteringService.terminalizeReconciliationFailure(eventId);
				return { eventId, status: terminal.status };
			}
		}

		throw new Error(`Unknown metering job ${job.name satisfies never}`);
	}

	private hasAttemptsRemaining(
		job: Job<MeteringJobData, unknown, MeteringJobName>,
	): boolean {
		const attempts =
			Number.isInteger(job.opts.attempts) && (job.opts.attempts ?? 0) > 0
				? (job.opts.attempts ?? 1)
				: 1;
		const attemptsMade = Number.isInteger(job.attemptsMade)
			? job.attemptsMade
			: 0;

		return attemptsMade + 1 < attempts;
	}

	private reconcileEventId(data: MeteringJobData): string {
		if (
			typeof data === "object" &&
			data !== null &&
			"eventId" in data &&
			typeof data.eventId === "string" &&
			data.eventId.length > 0
		) {
			return data.eventId;
		}

		throw new Error("Metering reconciliation job has no eventId");
	}
}
