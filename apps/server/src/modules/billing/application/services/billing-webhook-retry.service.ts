import { Inject, Injectable, Logger } from "@nestjs/common";
import type Stripe from "stripe";

import {
	type BillingWebhookEventRow,
	BillingWebhookEventsRepository,
} from "../../infrastructure/persistence/billing-webhook-events.repository";
import { StripeWebhookProcessor } from "./stripe-webhook-processor.service";

export const BILLING_WEBHOOK_MAX_ATTEMPTS = 8;
export const BILLING_WEBHOOK_RETRY_BASE_DELAY_MS = 60_000;
export const BILLING_WEBHOOK_RETRY_MAX_DELAY_MS = 60 * 60_000;
const BILLING_WEBHOOK_RETRY_SCAN_LIMIT = 500;

export type BillingWebhookRetryResult = {
	attemptCount: number;
	eventId: string;
	status: BillingWebhookEventRow["status"];
};

export type BillingWebhookSweepResult = {
	deadLettered: number;
	failed: number;
	retried: number;
	skipped: number;
};

@Injectable()
export class BillingWebhookRetryService {
	private readonly logger = new Logger(BillingWebhookRetryService.name);

	constructor(
		@Inject(BillingWebhookEventsRepository)
		private readonly repository: BillingWebhookEventsRepository,
		@Inject(StripeWebhookProcessor)
		private readonly processor: StripeWebhookProcessor,
	) {}

	async sweep(now = new Date()): Promise<BillingWebhookSweepResult> {
		const result: BillingWebhookSweepResult = {
			deadLettered: 0,
			failed: 0,
			retried: 0,
			skipped: 0,
		};
		const capped = await this.repository.listDeadLetterCandidates({
			limit: BILLING_WEBHOOK_RETRY_SCAN_LIMIT,
			maxAttempts: BILLING_WEBHOOK_MAX_ATTEMPTS,
		});

		for (const row of capped) {
			if (await this.transitionToDeadLetter(row.id)) {
				result.deadLettered += 1;
			}
		}

		const rows = await this.repository.listRetryableBelowAttemptLimit({
			limit: BILLING_WEBHOOK_RETRY_SCAN_LIMIT,
			maxAttempts: BILLING_WEBHOOK_MAX_ATTEMPTS,
		});

		for (const row of rows) {
			if (!this.isDue(row, now)) {
				result.skipped += 1;
				continue;
			}

			result.retried += 1;

			try {
				await this.retryEvent(row.id, BILLING_WEBHOOK_MAX_ATTEMPTS);
			} catch {
				result.failed += 1;

				if (await this.transitionToDeadLetter(row.id)) {
					result.deadLettered += 1;
				}
			}
		}

		return result;
	}

	private async transitionToDeadLetter(eventId: string): Promise<boolean> {
		const row = await this.repository.markDeadLettered(
			eventId,
			BILLING_WEBHOOK_MAX_ATTEMPTS,
		);

		if (!row) {
			return false;
		}

		this.logger.error(
			`BILLING_WEBHOOK_DEAD_LETTER event=${row.id} type=${row.type} attempts=${row.attemptCount}`,
			JSON.stringify({
				attempts: row.attemptCount,
				eventId: row.id,
				lastError: row.error,
				type: row.type,
			}),
		);

		return true;
	}

	async retryEvent(
		eventId: string,
		maxAttempts?: number,
	): Promise<BillingWebhookRetryResult> {
		const row = await this.repository.findById(eventId);

		if (!row) {
			throw new Error(`Billing webhook event ${eventId} was not found`);
		}

		if (row.status === "processed" || row.status === "skipped") {
			return this.toResult(row);
		}

		try {
			await this.processor.process(
				this.stripeEvent(row),
				maxAttempts === undefined ? {} : { maxAttempts },
			);
		} catch (error) {
			const current = await this.repository.findById(eventId);

			// Validation/provider failures happen before StripeWebhookProcessor can
			// claim the row. Advance those failures durably too, otherwise a corrupt
			// persisted event would remain retryable forever without reaching the cap.
			if (
				current &&
				current.status !== "processed" &&
				current.status !== "skipped" &&
				current.attemptCount === row.attemptCount
			) {
				await this.repository.recordRetryFailure({
					error: this.errorMessage(error),
					eventId,
					expectedAttemptCount: row.attemptCount,
				});
			}

			throw error;
		}
		const current = await this.repository.findById(eventId);

		if (!current) {
			throw new Error(
				`Billing webhook event ${eventId} disappeared after processing`,
			);
		}

		return this.toResult(current);
	}

	private isDue(row: BillingWebhookEventRow, now: Date): boolean {
		if (row.status === "processing") {
			return (
				row.claimedAt !== null &&
				row.claimedAt.getTime() + 5 * 60_000 <= now.getTime()
			);
		}

		const lastAttemptAt = row.processedAt ?? row.createdAt;
		const exponent = Math.max(row.attemptCount - 1, 0);
		const delay = Math.min(
			BILLING_WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** exponent,
			BILLING_WEBHOOK_RETRY_MAX_DELAY_MS,
		);

		return lastAttemptAt.getTime() + delay <= now.getTime();
	}

	private stripeEvent(row: BillingWebhookEventRow): Stripe.Event {
		if (row.provider !== "stripe") {
			throw new Error(
				`Billing webhook event ${row.id} has unsupported provider ${row.provider}`,
			);
		}

		const payload = row.payload;

		if (
			typeof payload !== "object" ||
			payload === null ||
			!("data" in payload) ||
			!("id" in payload) ||
			payload.id !== row.id ||
			!("type" in payload) ||
			payload.type !== row.type
		) {
			throw new Error(
				`Billing webhook event ${row.id} has an invalid persisted payload`,
			);
		}

		return payload as unknown as Stripe.Event;
	}

	private toResult(row: BillingWebhookEventRow): BillingWebhookRetryResult {
		return {
			attemptCount: row.attemptCount,
			eventId: row.id,
			status: row.status,
		};
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
