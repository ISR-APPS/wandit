/**
 * Pricing v8 cutover: ends every subscription and grants each pending refill slot.
 * The operator runs `pnpm --filter server billing:cutover-payg` (dry run), then with `--apply`.
 * runPayAsYouGoCutover holds the order of the run; main() wires it to Drizzle and Stripe.
 * Design record: docs/features/pricing-v8-pay-as-you-go.md, section 9.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { centiCreditsToCredits } from "@wandit/contracts";
import {
	and,
	asc,
	createDb,
	eq,
	gt,
	inArray,
	notInArray,
	sql,
} from "@wandit/db";
import {
	billingCheckoutAttempts,
	billingWebhookEvents,
	subscriptionRefillSlots,
	subscriptions,
} from "@wandit/db/schema/billing";
import { creditLedger } from "@wandit/db/schema/credits";
import { env } from "@wandit/env/server";
import Stripe from "stripe";

import { PaymentRefundsService } from "../src/modules/billing/application/services/payment-refunds.service";
import { StripeSubscriptionSyncService } from "../src/modules/billing/application/services/stripe-subscription-sync.service";
import { SubscriptionRefillService } from "../src/modules/billing/application/services/subscription-refill.service";
import { BillingCheckoutAttemptsRepository } from "../src/modules/billing/infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCreditLedgerRepository } from "../src/modules/billing/infrastructure/persistence/billing-credit-ledger.repository";
import { BillingCustomersRepository } from "../src/modules/billing/infrastructure/persistence/billing-customers.repository";
import { FinancialReconciliationOutboxRepository } from "../src/modules/billing/infrastructure/persistence/financial-reconciliation-outbox.repository";
import { OrganizationBillingCustomersRepository } from "../src/modules/billing/infrastructure/persistence/organization-billing-customers.repository";
import { SubscriptionCreditsRepository } from "../src/modules/billing/infrastructure/persistence/subscription-credits.repository";
import { SubscriptionStateEventsRepository } from "../src/modules/billing/infrastructure/persistence/subscription-state-events.repository";
import { SubscriptionsRepository } from "../src/modules/billing/infrastructure/persistence/subscriptions.repository";
import { STRIPE_API_VERSION } from "../src/modules/billing/infrastructure/stripe/stripe.constants";
import { StripeProvider } from "../src/modules/billing/infrastructure/stripe/stripe.provider";
import { CreditsService } from "../src/modules/credits/application/services/credits.service";
import {
	type CreditOwner,
	creditOwnerKey,
	ownerFromIds,
} from "../src/modules/credits/domain/credit-owner";
import { CreditsRepository } from "../src/modules/credits/infrastructure/persistence/credits.repository";
import { DomainsRepository } from "../src/modules/domains/infrastructure/persistence/domains.repository";
import { OrderRefundsService } from "../src/modules/orders/application/services/order-refunds.service";
import { PaymentOrdersRepository } from "../src/modules/orders/infrastructure/persistence/payment-orders.repository";

type SubscriptionRow = typeof subscriptions.$inferSelect;

/** The subscription fields the cutover reads. Each one comes from a fresh read of `subscriptions`. */
export type CutoverSubscription = Pick<
	SubscriptionRow,
	| "currentPeriodEnd"
	| "currentPeriodStart"
	| "id"
	| "organizationId"
	| "plan"
	| "priceLookupKey"
	| "provider"
	| "providerSubscriptionId"
	| "status"
	| "tierCredits"
	| "userId"
>;

/** A `billing_webhook_events` row of a subscription money event that is not done yet. */
export type BlockingWebhookEvent = {
	error: string | null;
	id: string;
	status: string;
	type: string;
};

/** An open `billing_checkout_attempts` row of purpose `subscription`. */
export type OpenSubscriptionCheckout = {
	attemptId: string;
	/** Stripe Checkout Session id. Null when the attempt never got a session. */
	sessionId: string | null;
};

/** A `credit_ledger` row of kind `expire`. After the release, only old code writes one. */
export type ExpireLedgerRow = {
	/** UNIT: centi-credits, negative. */
	delta: number;
	createdAt: Date;
	id: string;
	idempotencyKey: string | null;
	organizationId: string | null;
	userId: string | null;
};

/** Ledger sum of one pool per bucket. UNIT: centi-credits. */
export type BucketBalance = { plan: number; promo: number; topup: number };

/** Each read and write of the run. main() wires them; the spec passes fakes. */
export type CutoverDependencies = {
	/** Step 1. Rows of the six subscription money event types not in `processed` or `skipped`. */
	listBlockingWebhookEvents(): Promise<BlockingWebhookEvent[]>;
	/** Step 2. Attempts of purpose `subscription` in `created` or `session_attached`. */
	listOpenSubscriptionCheckouts(): Promise<OpenSubscriptionCheckout[]>;
	/** Stripe call. Returns the session status after the expire request. */
	expireCheckoutSession(sessionId: string): Promise<string | null>;
	markCheckoutExpired(attemptId: string): Promise<void>;
	/** Step 3. Ids of rows not in a terminal status, plus rows of any status with a `pending` slot. */
	listCandidateIds(): Promise<string[]>;
	reloadSubscription(
		subscriptionId: string,
	): Promise<CutoverSubscription | null>;
	listPendingSlotIds(subscriptionId: string): Promise<string[]>;
	ledgerBalance(owner: CreditOwner): Promise<BucketBalance>;
	/** Stripe customer balance in the minor unit. Null for a manual row. */
	stripeCustomerBalance(
		subscription: CutoverSubscription,
	): Promise<number | null>;
	/** Own transaction under the owner lock, with the reconciliation outbox row. */
	grantPendingSlot(slotId: string): Promise<"granted" | "skipped">;
	/** Stripe call: cancel now, no proration, no final invoice. */
	cancelStripeSubscription(
		providerSubscriptionId: string,
		idempotencyKey: string,
	): Promise<void>;
	syncStripeCustomer(subscription: CutoverSubscription): Promise<void>;
	setLocalStatus(providerSubscriptionId: string, status: string): Promise<void>;
	/** Sets `canceled` and writes one `ended` state event, under the owner lock. */
	endManualSubscription(subscription: CutoverSubscription): Promise<void>;
	listExpireRowsSince(releasedAt: Date): Promise<ExpireLedgerRow[]>;
};

/** Command-line flags of one run. */
type CutoverOptions = {
	/** True with `--apply`. False is a dry run that writes nothing. */
	apply: boolean;
	/** Deploy time of the release. Null skips step 6. */
	releasedAt: Date | null;
};

/** One report row per subscription. Credits are display credits (centi-credits / 100). */
export type CutoverRow = {
	action: string;
	creditsAfter: number | null;
	creditsBefore: number;
	customerBalanceMinor: number | null;
	error: string | null;
	grantedSlots: number;
	id: string;
	owner: string;
	pendingSlots: number;
	plan: string;
	planCredits: number;
	promoCredits: number;
	provider: string;
	result: "applied" | "dry_run" | "failed" | "skipped";
	status: string;
	tierCredits: number;
	topupCredits: number;
};

/** One report row per open subscription checkout session. */
type CutoverCheckoutRow = OpenSubscriptionCheckout & {
	error: string | null;
	/** Stripe session status, or "dry_run", "no session", "failed", "unknown". "complete" or "failed" gives exit code 1. */
	result: string;
};

/** The JSON that the script prints. `cutoverExitCode` reads it. */
type CutoverReport = {
	blockingEvents: BlockingWebhookEvent[];
	checkouts: CutoverCheckoutRow[];
	expireRows: ExpireLedgerRow[];
	rows: CutoverRow[];
};

/** Webhook types whose late handling changes credits or the subscription mirror. */
const CUTOVER_BLOCKING_EVENT_TYPES = [
	"checkout.session.async_payment_succeeded",
	"checkout.session.completed",
	"customer.subscription.created",
	"customer.subscription.deleted",
	"customer.subscription.updated",
	"invoice.paid",
] as const;

const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

/**
 * Runs steps 1 to 6 of the cutover. A dry run reads only. A second apply finds no
 * candidate, because each row is canceled and each slot is granted.
 */
export async function runPayAsYouGoCutover(
	options: CutoverOptions,
	dependencies: CutoverDependencies,
): Promise<CutoverReport> {
	const report: CutoverReport = {
		blockingEvents: await dependencies.listBlockingWebhookEvents(),
		checkouts: [],
		expireRows: [],
		rows: [],
	};

	// A late subscription event could still write with the old rules. The
	// operator replays it with `billing-webhook-retry-event` first.
	if (report.blockingEvents.length > 0) {
		return report;
	}

	// Expire the checkouts first: a session completed during the loop would
	// create a live subscription that this run never reads.
	for (const checkout of await dependencies.listOpenSubscriptionCheckouts()) {
		report.checkouts.push(
			await expireCheckout(checkout, options, dependencies),
		);
	}

	for (const subscriptionId of await dependencies.listCandidateIds()) {
		report.rows.push(
			await cutoverSubscription(subscriptionId, options, dependencies),
		);
	}

	if (options.releasedAt) {
		report.expireRows = await dependencies.listExpireRowsSince(
			options.releasedAt,
		);
	}

	return report;
}

/** 1 when the run stopped, a session completed, a row failed, or old code wrote an `expire` row. */
export function cutoverExitCode(report: CutoverReport): 0 | 1 {
	const failed =
		report.blockingEvents.length > 0 ||
		report.checkouts.some(
			(row) => row.result === "complete" || row.result === "failed",
		) ||
		report.rows.some((row) => row.result === "failed") ||
		report.expireRows.length > 0;

	return failed ? 1 : 0;
}

async function expireCheckout(
	checkout: OpenSubscriptionCheckout,
	options: CutoverOptions,
	dependencies: CutoverDependencies,
): Promise<CutoverCheckoutRow> {
	if (!checkout.sessionId) {
		return { ...checkout, error: null, result: "no session" };
	}

	if (!options.apply) {
		return { ...checkout, error: null, result: "dry_run" };
	}

	try {
		const status = await dependencies.expireCheckoutSession(checkout.sessionId);

		if (status === "expired") {
			await dependencies.markCheckoutExpired(checkout.attemptId);
		}

		// "complete": the webhook creates the subscription. Run --apply again after it.
		return { ...checkout, error: null, result: status ?? "unknown" };
	} catch (error) {
		return { ...checkout, error: errorMessage(error), result: "failed" };
	}
}

async function cutoverSubscription(
	subscriptionId: string,
	options: CutoverOptions,
	dependencies: CutoverDependencies,
): Promise<CutoverRow> {
	const subscription = await dependencies.reloadSubscription(subscriptionId);

	if (!subscription) {
		return emptyRow(subscriptionId, "skipped", "row disappeared");
	}

	const owner = ownerFromIds(subscription.userId, subscription.organizationId);
	const before = await dependencies.ledgerBalance(owner);
	const pendingSlotIds = await dependencies.listPendingSlotIds(subscription.id);
	const row: CutoverRow = {
		action: plannedAction(subscription, pendingSlotIds.length),
		creditsAfter: null,
		creditsBefore: displayCredits(sumBuckets(before)),
		customerBalanceMinor: null,
		error: null,
		grantedSlots: 0,
		id: subscription.id,
		owner: creditOwnerKey(owner),
		pendingSlots: pendingSlotIds.length,
		plan: subscription.plan,
		planCredits: displayCredits(before.plan),
		promoCredits: displayCredits(before.promo),
		provider: subscription.provider,
		result: options.apply ? "applied" : "dry_run",
		status: subscription.status,
		tierCredits: subscription.tierCredits,
		topupCredits: displayCredits(before.topup),
	};

	try {
		const customerBalance =
			await dependencies.stripeCustomerBalance(subscription);
		// Only a balance that is not zero needs a decision by the operator.
		row.customerBalanceMinor = customerBalance === 0 ? null : customerBalance;

		if (!options.apply) {
			return row;
		}

		// Grant before the cancel: a paid month never waits for a later run.
		for (const slotId of pendingSlotIds) {
			if ((await dependencies.grantPendingSlot(slotId)) === "granted") {
				row.grantedSlots += 1;
			}
		}

		if (!TERMINAL_STATUSES.has(subscription.status)) {
			await endSubscription(subscription, dependencies);
		}

		row.creditsAfter = displayCredits(
			sumBuckets(await dependencies.ledgerBalance(owner)),
		);
	} catch (error) {
		row.result = "failed";
		row.error = errorMessage(error);
	}

	return row;
}

async function endSubscription(
	subscription: CutoverSubscription,
	dependencies: CutoverDependencies,
): Promise<void> {
	if (subscription.provider !== "stripe") {
		await dependencies.endManualSubscription(subscription);
		return;
	}

	// No database transaction is open here. cancelSubscriptionNow makes up to
	// five Stripe requests, and an owner lock would block each credit consume.
	await dependencies.cancelStripeSubscription(
		subscription.providerSubscriptionId,
		`payg-cutover:${subscription.id}`,
	);
	// The webhook writes the state event. The sync only brings the mirror up to date.
	await dependencies.syncStripeCustomer(subscription);

	// Product rule: an `incomplete` row never had a first payment, so it must not
	// count as a past customer (isPaidOwner excludes `incomplete_expired`).
	if (subscription.status === "incomplete") {
		await dependencies.setLocalStatus(
			subscription.providerSubscriptionId,
			"incomplete_expired",
		);
	}
}

function plannedAction(
	subscription: CutoverSubscription,
	pendingSlots: number,
): string {
	const slots = pendingSlots > 0 ? `grant ${pendingSlots} slot(s), ` : "";

	if (TERMINAL_STATUSES.has(subscription.status)) {
		return `${slots}already ended`;
	}

	return subscription.provider === "stripe"
		? `${slots}cancel in Stripe and sync`
		: `${slots}end manual row`;
}

function emptyRow(
	id: string,
	result: CutoverRow["result"],
	error: string,
): CutoverRow {
	return {
		action: "none",
		creditsAfter: null,
		creditsBefore: 0,
		customerBalanceMinor: null,
		error,
		grantedSlots: 0,
		id,
		owner: "",
		pendingSlots: 0,
		plan: "",
		planCredits: 0,
		promoCredits: 0,
		provider: "",
		result,
		status: "",
		tierCredits: 0,
		topupCredits: 0,
	};
}

function sumBuckets(balance: BucketBalance): number {
	return balance.plan + balance.promo + balance.topup;
}

// The ledger stores centi-credits; the operator reads display credits.
function displayCredits(centiCredits: number): number {
	return centiCreditsToCredits(centiCredits);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function parseArguments(args: readonly string[]): CutoverOptions {
	let apply = false;
	let releasedAt: Date | null = null;

	for (const argument of args) {
		if (argument === "--apply") {
			apply = true;
		} else if (argument.startsWith("--released-at=")) {
			releasedAt = new Date(argument.slice("--released-at=".length));

			if (Number.isNaN(releasedAt.getTime())) {
				throw new Error(`--released-at is not an ISO time: ${argument}`);
			}
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}

	return { apply, releasedAt };
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const stripeSecretKey = env.STRIPE_SECRET_KEY;

	if (!stripeSecretKey) {
		throw new Error("STRIPE_SECRET_KEY is required");
	}

	const database = createDb();
	const stripe = new Stripe(stripeSecretKey, {
		apiVersion: STRIPE_API_VERSION,
		typescript: true,
	});
	const stripeProvider = new StripeProvider();
	const creditsRepository = new CreditsRepository(database);
	const credits = new CreditsService(creditsRepository);
	const subscriptionCredits = new SubscriptionCreditsRepository(database);
	const subscriptionsRepository = new SubscriptionsRepository(database);
	const stateEvents = new SubscriptionStateEventsRepository(database);
	const billingCustomers = new BillingCustomersRepository(database);
	const organizationCustomers = new OrganizationBillingCustomersRepository(
		database,
	);
	const checkoutAttempts = new BillingCheckoutAttemptsRepository(database);
	const refills = new SubscriptionRefillService(
		subscriptionCredits,
		credits,
		new PaymentRefundsService(
			new BillingCreditLedgerRepository(database),
			credits,
			new OrderRefundsService(
				new PaymentOrdersRepository(database),
				new DomainsRepository(database),
			),
			stripeProvider,
		),
		new FinancialReconciliationOutboxRepository(database),
	);
	const sync = new StripeSubscriptionSyncService(
		billingCustomers,
		subscriptionsRepository,
		stripeProvider,
		organizationCustomers,
	);

	const providerCustomerId = async (subscription: CutoverSubscription) => {
		const customer = subscription.organizationId
			? await organizationCustomers.findByOrganizationId(
					subscription.organizationId,
				)
			: await billingCustomers.findByUserId(subscription.userId);

		if (!customer) {
			throw new Error(`No Stripe customer for subscription ${subscription.id}`);
		}

		return customer.providerCustomerId;
	};

	const dependencies: CutoverDependencies = {
		cancelStripeSubscription: (providerSubscriptionId, idempotencyKey) =>
			stripeProvider.cancelSubscriptionNow(
				providerSubscriptionId,
				idempotencyKey,
			),
		endManualSubscription: (snapshot) =>
			subscriptionCredits.withOwnerLock(
				ownerFromIds(snapshot.userId, snapshot.organizationId),
				async (tx) => {
					const current = await subscriptionsRepository.findById(
						snapshot.id,
						tx,
					);

					if (!current || TERMINAL_STATUSES.has(current.status)) {
						return;
					}

					await subscriptionsRepository.updatePeriod(
						current.id,
						{
							cancelAtPeriodEnd: false,
							currentPeriodEnd: current.currentPeriodEnd,
							currentPeriodStart: current.currentPeriodStart,
							status: "canceled",
						},
						tx,
					);
					// Same key form as the old manual `terminate`: analytics reads the
					// `manual:` prefix, and a second run inserts nothing.
					await stateEvents.tryInsert(
						{
							fromLookupKey: current.priceLookupKey,
							fromStatus: current.status,
							kind: "ended",
							occurredAt: new Date(),
							organizationId: current.organizationId,
							stripeEventId: `manual:${current.id}:ended:${current.currentPeriodStart.getTime()}:${current.currentPeriodEnd.getTime()}`,
							stripeSubscriptionId: current.providerSubscriptionId,
							toStatus: "canceled",
							userId: current.userId,
						},
						tx,
					);
				},
			),
		expireCheckoutSession: (sessionId) =>
			stripeProvider.expireCheckoutSession(sessionId),
		grantPendingSlot: (slotId) => refills.grantPendingSlot(slotId),
		ledgerBalance: async (owner) => {
			const balance = await creditsRepository.getBalance(owner);

			return {
				plan: balance.plan,
				promo: balance.promo,
				topup: balance.topup,
			};
		},
		listBlockingWebhookEvents: () =>
			database
				.select({
					error: billingWebhookEvents.error,
					id: billingWebhookEvents.id,
					status: billingWebhookEvents.status,
					type: billingWebhookEvents.type,
				})
				.from(billingWebhookEvents)
				.where(
					and(
						notInArray(billingWebhookEvents.status, ["processed", "skipped"]),
						inArray(billingWebhookEvents.type, [
							...CUTOVER_BLOCKING_EVENT_TYPES,
						]),
					),
				)
				.orderBy(asc(billingWebhookEvents.createdAt)),
		listCandidateIds: async () => {
			const rows = await database
				.select({ id: subscriptions.id })
				.from(subscriptions)
				.where(
					sql`${subscriptions.status} not in ('canceled', 'incomplete_expired') or exists (select 1 from ${subscriptionRefillSlots} where ${subscriptionRefillSlots.subscriptionId} = ${subscriptions.id} and ${subscriptionRefillSlots.status} = 'pending')`,
				)
				.orderBy(asc(subscriptions.id));

			return rows.map((row) => row.id);
		},
		listExpireRowsSince: (releasedAt) =>
			database
				.select({
					createdAt: creditLedger.createdAt,
					delta: creditLedger.delta,
					id: creditLedger.id,
					idempotencyKey: creditLedger.idempotencyKey,
					organizationId: creditLedger.organizationId,
					userId: creditLedger.userId,
				})
				.from(creditLedger)
				.where(
					and(
						eq(creditLedger.kind, "expire"),
						gt(creditLedger.createdAt, releasedAt),
					),
				)
				.orderBy(asc(creditLedger.createdAt)),
		listOpenSubscriptionCheckouts: async () => {
			const rows = await database
				.select({
					attemptId: billingCheckoutAttempts.id,
					sessionId: billingCheckoutAttempts.providerSessionId,
				})
				.from(billingCheckoutAttempts)
				.where(
					and(
						eq(billingCheckoutAttempts.purpose, "subscription"),
						inArray(billingCheckoutAttempts.status, [
							"created",
							"session_attached",
						]),
					),
				)
				.orderBy(asc(billingCheckoutAttempts.createdAt));

			return rows;
		},
		listPendingSlotIds: async (subscriptionId) => {
			const rows = await database
				.select({ id: subscriptionRefillSlots.id })
				.from(subscriptionRefillSlots)
				.where(
					and(
						eq(subscriptionRefillSlots.subscriptionId, subscriptionId),
						eq(subscriptionRefillSlots.status, "pending"),
					),
				)
				.orderBy(
					asc(subscriptionRefillSlots.dueAt),
					asc(subscriptionRefillSlots.periodOrdinal),
				);

			return rows.map((row) => row.id);
		},
		markCheckoutExpired: async (attemptId) => {
			await checkoutAttempts.markExpired(attemptId);
		},
		reloadSubscription: (subscriptionId) =>
			subscriptionsRepository.findById(subscriptionId),
		setLocalStatus: async (providerSubscriptionId, status) => {
			await subscriptionsRepository.updateStatus(
				providerSubscriptionId,
				status,
			);
		},
		stripeCustomerBalance: async (subscription) => {
			if (subscription.provider !== "stripe") {
				return null;
			}

			const customer = await stripe.customers.retrieve(
				await providerCustomerId(subscription),
			);

			return customer.deleted ? null : customer.balance;
		},
		syncStripeCustomer: async (subscription) => {
			await sync.syncFromStripe(await providerCustomerId(subscription));
		},
	};

	const report = await runPayAsYouGoCutover(options, dependencies).finally(() =>
		database.$client.end(),
	);

	console.log(
		`Pricing v8 pay-as-you-go cutover (${options.apply ? "APPLY" : "DRY RUN"}; Stripe API ${STRIPE_API_VERSION})`,
	);

	if (report.blockingEvents.length > 0) {
		console.log(
			"STOPPED: replay or skip these webhook events, then run again.",
		);
		console.table(report.blockingEvents);
	}

	console.table(report.checkouts);
	console.table(report.rows);

	if (report.expireRows.length > 0) {
		console.log(
			"Old code wrote expire rows after the release. Grant each amount back.",
		);
		console.table(report.expireRows);
	}

	process.exitCode = cutoverExitCode(report);
}

const entrypoint = process.argv[1];

if (entrypoint && fileURLToPath(import.meta.url) === resolve(entrypoint)) {
	await main();
}
