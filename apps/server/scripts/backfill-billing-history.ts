import { and, asc, createDb, eq, gt, inArray, isNull, or } from "@wandit/db";
import { billingWebhookEvents } from "@wandit/db/schema/billing";
import type Stripe from "stripe";

import { SubscriptionLifecycleService } from "../src/modules/billing/application/services/subscription-lifecycle.service";
import { BillingCustomersRepository } from "../src/modules/billing/infrastructure/persistence/billing-customers.repository";
import { BillingPaymentAdjustmentsRepository } from "../src/modules/billing/infrastructure/persistence/billing-payment-adjustments.repository";
import { OrganizationBillingCustomersRepository } from "../src/modules/billing/infrastructure/persistence/organization-billing-customers.repository";
import { SubscriptionStateEventsRepository } from "../src/modules/billing/infrastructure/persistence/subscription-state-events.repository";
import { SubscriptionsRepository } from "../src/modules/billing/infrastructure/persistence/subscriptions.repository";

const BATCH_SIZE = 500;
const RELEVANT_EVENT_TYPES = [
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
	"invoice.payment_failed",
	"charge.refunded",
] as const satisfies readonly Stripe.Event.Type[];

type RelevantEventType = (typeof RELEVANT_EVENT_TYPES)[number];
type BackfillCounts = Record<
	RelevantEventType,
	{ inserted: number; skipped: number }
>;
type BackfillCursor = {
	eventCreatedAt: Date | null;
	id: string;
};

async function main(): Promise<void> {
	const db = createDb();
	const lifecycle = new SubscriptionLifecycleService(
		new SubscriptionStateEventsRepository(db),
		new BillingPaymentAdjustmentsRepository(db),
		new SubscriptionsRepository(db),
		new BillingCustomersRepository(db),
		new OrganizationBillingCustomersRepository(db),
	);
	const counts = createCounts();
	let cursor: BackfillCursor | null = null;

	try {
		while (true) {
			const rows = await db
				.select({
					eventCreatedAt: billingWebhookEvents.eventCreatedAt,
					id: billingWebhookEvents.id,
					payload: billingWebhookEvents.payload,
					type: billingWebhookEvents.type,
				})
				.from(billingWebhookEvents)
				.where(
					and(
						eq(billingWebhookEvents.provider, "stripe"),
						inArray(billingWebhookEvents.type, [...RELEVANT_EVENT_TYPES]),
						afterCursor(cursor),
					),
				)
				.orderBy(
					asc(billingWebhookEvents.eventCreatedAt),
					asc(billingWebhookEvents.id),
				)
				.limit(BATCH_SIZE);

			if (rows.length === 0) {
				break;
			}

			for (const row of rows) {
				if (!isRelevantEventType(row.type)) {
					continue;
				}

				const result = await lifecycle.recordEvent(row.payload as Stripe.Event);
				counts[row.type].inserted += result.inserted;
				counts[row.type].skipped += result.skipped;
			}

			const last = rows.at(-1);
			if (last) {
				cursor = {
					eventCreatedAt: last.eventCreatedAt,
					id: last.id,
				};
			}
		}

		console.log("Billing history backfill complete.");
		for (const type of RELEVANT_EVENT_TYPES) {
			console.log(
				`${type}: inserted=${counts[type].inserted} skipped=${counts[type].skipped}`,
			);
		}
	} finally {
		await db.$client.end();
	}
}

function afterCursor(cursor: BackfillCursor | null) {
	if (!cursor) {
		return undefined;
	}

	if (cursor.eventCreatedAt === null) {
		return and(
			isNull(billingWebhookEvents.eventCreatedAt),
			gt(billingWebhookEvents.id, cursor.id),
		);
	}

	return or(
		gt(billingWebhookEvents.eventCreatedAt, cursor.eventCreatedAt),
		and(
			eq(billingWebhookEvents.eventCreatedAt, cursor.eventCreatedAt),
			gt(billingWebhookEvents.id, cursor.id),
		),
		isNull(billingWebhookEvents.eventCreatedAt),
	);
}

function createCounts(): BackfillCounts {
	return Object.fromEntries(
		RELEVANT_EVENT_TYPES.map((type) => [type, { inserted: 0, skipped: 0 }]),
	) as BackfillCounts;
}

function isRelevantEventType(type: string): type is RelevantEventType {
	return (RELEVANT_EVENT_TYPES as readonly string[]).includes(type);
}

await main();
