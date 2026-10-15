/**
 * Sends one renewal reminder email per subscription period, about 3 days before current_period_end.
 * The Trigger task `subscription-renewal-reminders` calls execute() every hour, without Nest.
 * Reads and marks rows through SubscriptionsRepository and sends through EmailService, both passed in.
 */
import type { EmailService } from "../../../email/application/services/email.service";
import type {
	RenewalReminderCursor,
	RenewalReminderRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const MARK_MAX_ATTEMPTS = 3;
const MARK_RETRY_DELAY_MS = 50;

/**
 * 3 days: enough time to change the card, cancel, or renew a manual plan before the date.
 * The hourly run sends the email within one hour of this mark.
 */
const RENEWAL_REMINDER_LEAD_DAYS = 3;

/** Rows per keyset page. Keeps each query and each page in memory small. */
export const RENEWAL_REMINDER_PAGE_SIZE = 100;

/** The two repository methods that the sweep uses. The spec passes an in-memory fake. */
export type SubscriptionRenewalReminderStore = Pick<
	SubscriptionsRepository,
	"listDueForRenewalReminder" | "markRenewalReminderSent"
>;

/** EmailService.sendSubscriptionRenewalReminder. A thrown error means Resend did not accept the email. */
export type SubscriptionRenewalReminderEmailSender = Pick<
	EmailService,
	"sendSubscriptionRenewalReminder"
>;

/** The Trigger logger in production. Details never hold the email address. */
export type SubscriptionRenewalReminderLogger = {
	error(
		message: string,
		details: { error: string; subscriptionId: string },
	): void;
};

/** `sent`: emails that Resend accepted. `marked`: rows marked for their period. */
export type SubscriptionRenewalRemindersResult = {
	marked: number;
	sent: number;
};

/** Built by hand in createSubscriptionRenewalRemindersRuntime, without Nest DI. The spec gives it in-memory fakes. */
export class SubscriptionRenewalRemindersService {
	constructor(
		private readonly store: SubscriptionRenewalReminderStore,
		private readonly email: SubscriptionRenewalReminderEmailSender,
		private readonly logger: SubscriptionRenewalReminderLogger,
	) {}

	/**
	 * Reminds every row with a period end in (now, now + 3 days]. A failed row stays unmarked,
	 * so the next hourly run tries it again. Throws after the sweep when one row or more failed.
	 */
	async execute(now: Date): Promise<SubscriptionRenewalRemindersResult> {
		const until = new Date(now.getTime() + RENEWAL_REMINDER_LEAD_DAYS * DAY_MS);
		const failures: unknown[] = [];
		let sent = 0;
		let marked = 0;
		let after: RenewalReminderCursor | null = null;
		let rows: RenewalReminderRow[];

		// LIMIT: one send at a time, below the Resend team limit of 10 requests per second.
		// Rows past the 600 s task limit wait for the next hour. Upgrade: the Resend batch API.
		do {
			rows = await this.store.listDueForRenewalReminder({
				after,
				from: now,
				limit: RENEWAL_REMINDER_PAGE_SIZE,
				until,
			});

			for (const row of rows) {
				// The cursor moves past every row, also a failed one. Without the cursor,
				// the next page returns the unmarked failed row again.
				after = { currentPeriodEnd: row.currentPeriodEnd, id: row.id };

				// Product rule: only Stripe renews by itself. A manual plan (SlickPay, offline) ends.
				const renews = row.provider === "stripe";

				// A mark failure comes after the send: the user has the email, and only the row stays due.
				let stage: "mark" | "send" = "send";

				try {
					await this.email.sendSubscriptionRenewalReminder({
						// The period end is in the key: the next period gets its own email.
						idempotencyKey: `subscription-renewal-reminder:${row.id}:${row.currentPeriodEnd.toISOString()}`,
						// A scheduled downgrade starts at the renewal, so Stripe charges for the pending plan.
						// An expiry notice names the current plan, because that plan ends.
						interval: renews
							? (row.pendingInterval ?? row.interval)
							: row.interval,
						kind: renews ? "renews" : "expires",
						name: row.name,
						organizationName: row.organizationName,
						periodEnd: row.currentPeriodEnd,
						plan: renews ? (row.pendingPlan ?? row.plan) : row.plan,
						to: row.email,
					});
					sent += 1;
					stage = "mark";

					// False: a renewal moved the period after the read. The new period gets its own reminder.
					if (await this.markSent(row)) {
						marked += 1;
					}
				} catch (error) {
					failures.push(error);
					this.logger.error(
						stage === "send"
							? "Subscription renewal reminder send failed"
							: "Subscription renewal reminder sent, but the mark failed",
						{
							error: error instanceof Error ? error.message : String(error),
							subscriptionId: row.id,
						},
					);
				}
			}
			// A short page is the last page.
		} while (rows.length === RENEWAL_REMINDER_PAGE_SIZE);

		// One error at the end: the other rows still go out, and Trigger and Sentry see the failure.
		if (failures.length > 0) {
			throw new AggregateError(
				failures,
				`Subscription renewal reminders failed for ${failures.length} rows (${sent} sent, ${marked} marked)`,
			);
		}

		return { marked, sent };
	}

	// The email is out. A lost connection must not leave the row unmarked, or the
	// next run sends again (Resend drops the copy only within 24 hours). So it tries 3 times.
	private async markSent(row: RenewalReminderRow): Promise<boolean> {
		for (let attempt = 1; ; attempt += 1) {
			try {
				return await this.store.markRenewalReminderSent(
					row.id,
					row.currentPeriodEnd,
				);
			} catch (error) {
				if (attempt >= MARK_MAX_ATTEMPTS) {
					throw error;
				}

				await new Promise<void>((resolve) => {
					setTimeout(resolve, MARK_RETRY_DELAY_MS * attempt);
				});
			}
		}
	}
}
