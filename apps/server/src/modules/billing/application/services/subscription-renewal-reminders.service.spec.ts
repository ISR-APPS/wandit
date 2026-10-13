import { describe, expect, it, vi } from "vitest";

import type { RenewalReminderRow } from "../../infrastructure/persistence/subscriptions.repository";
import {
	RENEWAL_REMINDER_PAGE_SIZE,
	type SubscriptionRenewalReminderEmailSender,
	type SubscriptionRenewalReminderLogger,
	type SubscriptionRenewalReminderStore,
	SubscriptionRenewalRemindersService,
} from "./subscription-renewal-reminders.service";

type ReminderEmail = Parameters<
	SubscriptionRenewalReminderEmailSender["sendSubscriptionRenewalReminder"]
>[0];

const NOW = new Date("2026-10-13T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function reminderRow(
	index: number,
	overrides: Partial<RenewalReminderRow> = {},
): RenewalReminderRow {
	return {
		// One second apart, so the keyset order is the index order.
		currentPeriodEnd: new Date(NOW.getTime() + HOUR_MS + index * 1000),
		email: `user${index}@example.com`,
		id: `sub_${index}`,
		interval: "month",
		name: `User ${index}`,
		organizationName: null,
		pendingInterval: null,
		pendingPlan: null,
		plan: "pro",
		provider: "stripe",
		...overrides,
	};
}

// The fake store keeps the repository contract: unmarked rows after the cursor, in keyset order.
function setup(rows: RenewalReminderRow[], failingEmails: string[] = []) {
	const markedIds = new Set<string>();
	const store: SubscriptionRenewalReminderStore = {
		async listDueForRenewalReminder({ after, limit }) {
			return rows
				.filter(
					(row) =>
						!markedIds.has(row.id) &&
						(after === null || row.currentPeriodEnd > after.currentPeriodEnd),
				)
				.slice(0, limit);
		},
		async markRenewalReminderSent(id) {
			markedIds.add(id);
			return true;
		},
	};
	const email = {
		sendSubscriptionRenewalReminder: vi.fn(async (input: ReminderEmail) => {
			if (failingEmails.includes(input.to)) {
				throw new Error("Resend rejected the email");
			}
		}),
	} satisfies SubscriptionRenewalReminderEmailSender;
	const logger = { error: vi.fn() } satisfies SubscriptionRenewalReminderLogger;

	return {
		email,
		markedIds,
		service: new SubscriptionRenewalRemindersService(store, email, logger),
	};
}

describe("SubscriptionRenewalRemindersService", () => {
	// The stripe row has a scheduled downgrade: Stripe bills Starter monthly at the period end.
	it.each([
		{
			expected: { interval: "month", kind: "renews", plan: "starter" },
			row: {
				interval: "year",
				pendingInterval: "month",
				pendingPlan: "starter",
				plan: "pro",
				provider: "stripe",
			},
		},
		{
			expected: { interval: "year", kind: "expires", plan: "pro" },
			row: { interval: "year", plan: "pro", provider: "manual" },
		},
	] as const)("sends the $expected.kind email with the billed plan for a $row.provider row", async ({
		expected,
		row,
	}) => {
		const { email, service } = setup([reminderRow(1, row)]);

		await service.execute(NOW);

		expect(email.sendSubscriptionRenewalReminder).toHaveBeenCalledWith(
			expect.objectContaining(expected),
		);
	});

	it("pages past a failed row: sends each row once, marks the others, then throws", async () => {
		// One full page plus one row, so the last row is only on the second page.
		const rows = Array.from(
			{ length: RENEWAL_REMINDER_PAGE_SIZE + 1 },
			(_, index) => reminderRow(index),
		);
		const { email, markedIds, service } = setup(rows, ["user0@example.com"]);

		await expect(service.execute(NOW)).rejects.toThrow(AggregateError);

		const sentTo = email.sendSubscriptionRenewalReminder.mock.calls.map(
			([input]) => input.to,
		);
		expect(sentTo).toEqual(rows.map((row) => row.email));
		expect(markedIds).toEqual(new Set(rows.slice(1).map((row) => row.id)));
	});
});
