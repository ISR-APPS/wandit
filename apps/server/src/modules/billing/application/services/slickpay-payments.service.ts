/**
 * SlickPay checkout for buyers in Algeria: one DZD card payment buys one wallet top-up, or the Starter pass.
 * SlickpayBillingController calls localPricing, startCheckout, and confirm. The Trigger.dev sweep calls sweep.
 * It calls the SlickPay client, the slickpay_payments repository, CreditsService, the receipts and Starter pass repositories.
 * A Starter pass checkout also calls BillingService to close the open card checkouts of the pool.
 */
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingLocalPricingResponse,
	CENTI_CREDITS_PER_CREDIT,
	centiCreditsToCredits,
	creditsToCentiCredits,
	dzdPriceFor,
	isSlickpayInvoicePaid,
	type SlickpayCreateInvoiceResponse,
	type SlickpayPaymentView,
	STARTER_PASS_USD,
	type StartSlickpayCheckoutBody,
	type StartSlickpayCheckoutResponse,
	TOPUP_CREDITS_PER_USD,
	topupCreditsForUsd,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	ownerFromIds,
} from "../../../credits/domain/credit-owner";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { lifecycleEventIdempotencyKey } from "../../../lifecycle-events/domain/lifecycle-event";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { OrganizationsDisabledError } from "../../../settings/domain/errors/organizations-disabled.error";
import { WorkspacePermissionDeniedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { BillingCheckoutPendingError } from "../../domain/errors/billing-checkout-pending.error";
import {
	SlickpayNotConfiguredError,
	SlickpayTooManyCheckoutsError,
	SlickpayUnavailableError,
} from "../../domain/errors/slickpay.errors";
import {
	StarterPassNotAvailableError,
	StarterPassSlickpayOpenError,
} from "../../domain/errors/starter-pass.errors";
import {
	BillingCheckoutAttemptsRepository,
	type BillingCheckoutAttemptTransaction,
} from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingTopupReceiptsRepository } from "../../infrastructure/persistence/billing-topup-receipts.repository";
import {
	type ManualSubscriptionPaymentRow,
	ManualSubscriptionPaymentsRepository,
} from "../../infrastructure/persistence/manual-subscription-payments.repository";
import {
	type InsertSlickpayPaymentInput,
	type SlickpayPaymentChanges,
	type SlickpayPaymentRow,
	SlickpayPaymentsRepository,
	STARTER_PASS_HOLD_MS,
} from "../../infrastructure/persistence/slickpay-payments.repository";
import { StarterPassesRepository } from "../../infrastructure/persistence/starter-passes.repository";
import {
	SubscriptionCreditsRepository,
	type SubscriptionCreditsTransaction,
} from "../../infrastructure/persistence/subscription-credits.repository";
import {
	SLICKPAY_CLIENT,
	type SlickpayClient,
} from "../../infrastructure/slickpay/slickpay.client";
import { BillingService, isBlockingTopupAttempt } from "./billing.service";

// Each checkout creates a real SlickPay invoice, so one user gets at most 5 checkouts in 10 minutes.
const CHECKOUT_LIMIT = 5;
const CHECKOUT_WINDOW_MS = 10 * 60_000;
// The process can stop between the insert and the invoice. After 1 h, such a "created" row is failed.
const CREATED_TIMEOUT_MS = 60 * 60_000;
// An invoice that is still unpaid 24 h after the checkout expires.
const PENDING_EXPIRY_MS = 24 * 60 * 60_000;
// The web polls confirm every 3 s. A 2 s floor per row keeps that polling and stops a loop script.
const INVOICE_CHECK_INTERVAL_MS = 2_000;
const SWEEP_BATCH_SIZE = 50;
// A yearly plan row from before pricing v8 paid for 12 monthly allotments.
const MONTHS_PER_YEAR = 12;

/** Counts of one sweep run. The Trigger.dev task logs and returns them. */
export type SlickpayPaymentSweepResult = {
	/** Open rows that the run read. */
	checked: number;
	/** Rows that the run fulfilled. */
	fulfilled: number;
	/** Rows still "paid" after the run: SlickPay has the money, but no credits are granted. See last_error. */
	stillPaid: number;
	/** Rows whose refresh threw, for example on a SlickPay timeout. The next run tries them again. */
	errors: number;
};

/** What one paid row grants. */
type SlickpayTopupGrant = {
	/** UNIT: centi-credits, the ledger unit. Always above zero. */
	centiCredits: number;
	/** USD value that set the credits, in cents. Null when the DZD amount is below 1 cent. */
	amountUsdCents: number | null;
};

/** Owns the SlickPay payment states. A paid row becomes one top-up of the wallet and one receipt. */
@Injectable()
export class SlickpayPaymentsService {
	private readonly logger = new Logger(SlickpayPaymentsService.name);

	constructor(
		@Inject(SlickpayPaymentsRepository)
		private readonly payments: Pick<
			SlickpayPaymentsRepository,
			| "claimInvoiceCheck"
			| "countByUserSince"
			| "findById"
			| "findOpenStarterPasses"
			| "insert"
			| "listOpen"
			| "updateIfStatus"
		>,
		// Null when the API has no SLICKPAY_PUBLIC_KEY. See slickpayClientFromEnv.
		@Inject(SLICKPAY_CLIENT)
		private readonly slickpay: Pick<
			SlickpayClient,
			"createInvoice" | "getInvoice"
		> | null,
		// Old plan payments. A row from before pricing v8 can already be granted as a manual plan.
		@Inject(ManualSubscriptionPaymentsRepository)
		private readonly manualPayments: Pick<
			ManualSubscriptionPaymentsRepository,
			"findByIdempotencyKey" | "findSlickpayByReference"
		>,
		// Owner lock: the same advisory key as the credit ledger.
		@Inject(SubscriptionCreditsRepository)
		private readonly ownerLock: Pick<
			SubscriptionCreditsRepository,
			"withOwnerLock"
		>,
		@Inject(CreditsService)
		private readonly credits: Pick<
			CreditsService,
			"getSettledBalance" | "topup"
		>,
		@Inject(BillingTopupReceiptsRepository)
		private readonly receipts: Pick<
			BillingTopupReceiptsRepository,
			"insertIfAbsent"
		>,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: Pick<LifecycleEventsService, "enqueue">,
		// withOwnerLock has the same advisory key as ownerLock, and its transaction type fits findOpenForOwner.
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttempts: Pick<
			BillingCheckoutAttemptsRepository,
			"findOpenForOwner" | "withOwnerLock" | "withUserLock"
		>,
		@Inject(ProductSettingsService)
		private readonly productSettings: Pick<ProductSettingsService, "get">,
		@Inject(StarterPassesRepository)
		private readonly starterPasses: Pick<
			StarterPassesRepository,
			"grantIfAbsent"
		>,
		// A Starter pass checkout closes the open card checkouts of the pool first.
		@Inject(BillingService)
		private readonly cardCheckouts: Pick<
			BillingService,
			"expireOpenTopupSessions"
		>,
	) {}

	/**
	 * The answer of GET local-pricing. `countryCode` comes from the edge headers of the visitor request.
	 * `dzdPerUsdRate` goes to every visitor. `slickpay` stays Algeria-only for old cached web bundles.
	 */
	async localPricing(
		countryCode: string | null,
	): Promise<BillingLocalPricingResponse> {
		if (!this.slickpay) {
			return { dzdPerUsdRate: null, slickpay: null };
		}

		const settings = await this.productSettings.get();
		// product_settings stores centi-DZD: 25000 is 250.00 DZD per 1 USD.
		const dzdPerUsdRate = settings.dzdPerUsdRate / 100;

		// An old web bundle reads a non-null `slickpay` as "the visitor is in Algeria".
		return {
			dzdPerUsdRate,
			slickpay: countryCode === "DZ" ? { dzdPerUsdRate } : null,
		};
	}

	/**
	 * Inserts a payment row and creates its SlickPay invoice. The web sends the buyer to the answered URL.
	 * The row stores the credits at checkout, so a later rate change does not change the grant.
	 * A Starter pass body answers 409 STARTER_PASS_NOT_AVAILABLE when the pool does not need the pass.
	 * A pool has at most one open Starter pass page: a second Starter pass request of the same buyer gets the same URL.
	 */
	async startCheckout(
		user: Pick<AuthUser, "email" | "id">,
		body: StartSlickpayCheckoutBody,
		workspace?: WorkspaceContext,
	): Promise<StartSlickpayCheckoutResponse> {
		const slickpay = this.slickpay;

		if (!slickpay) {
			throw new SlickpayNotConfiguredError();
		}

		const settings = await this.productSettings.get();
		const organizationId = resolveBillingOrganizationId(workspace);

		if (organizationId && !settings.organizationsEnabled) {
			throw new OrganizationsDisabledError();
		}

		const amountUsd = "amountUsd" in body ? body.amountUsd : STARTER_PASS_USD;
		// product_settings stores centi-DZD: 25000 is 250.00 DZD per 1 USD.
		const amountDzd = dzdPriceFor(amountUsd, settings.dzdPerUsdRate / 100);
		const input: InsertSlickpayPaymentInput = {
			amountDzd,
			// Whole USD (the parsed body, or STARTER_PASS_USD). The column holds USD cents.
			amountUsdCents: amountUsd * 100,
			// The ledger counts centi-credits. topupCreditsForUsd gives whole credits.
			credits: creditsToCentiCredits(topupCreditsForUsd(amountUsd)),
			dzdPerUsdRate: settings.dzdPerUsdRate,
			organizationId,
			userId: user.id,
		};
		let row: SlickpayPaymentRow;

		if ("starterPass" in body) {
			const owner = ownerFromIds(user.id, organizationId);
			// Stripe calls stay outside the owner lock: that lock also serializes every debit of the pool.
			await this.cardCheckouts.expireOpenTopupSessions(owner);
			const reserved = await this.checkoutAttempts.withOwnerLock(owner, (tx) =>
				this.reserveStarterPass(owner, input, tx),
			);

			// The buyer already has an open invoice of this pass. It stays valid, so make no second one.
			if (reserved.paymentUrl !== null) {
				return { paymentId: reserved.id, url: reserved.paymentUrl };
			}

			row = reserved;
		} else {
			// The user lock makes the count and the insert one step, so parallel requests cannot pass the limit.
			row = await this.checkoutAttempts.withUserLock(user.id, (tx) =>
				this.insertWithinLimit(input, tx),
			);
		}

		// SlickPay asks for a first name and a last name. A one-word name goes in both fields.
		const names = body.fullName.split(/\s+/);
		const firstName = names[0] ?? body.fullName;
		const lastName = names.length > 1 ? names.slice(1).join(" ") : firstName;
		const returnUrl = new URL("/billing/slickpay", env.CORS_ORIGIN);
		returnUrl.searchParams.set("payment", row.id);
		let invoice: SlickpayCreateInvoiceResponse;

		try {
			invoice = await slickpay.createInvoice({
				address: `${body.city}, Algeria`,
				amountDzd,
				email: user.email,
				firstName,
				fullName: body.fullName,
				itemName: "Wandit credits",
				lastName,
				phone: body.phone,
				returnUrl: returnUrl.toString(),
			});
		} catch (error) {
			// The buyer never got a payment URL, so "failed" cannot hide a payment.
			await this.move(row, {
				lastError: `Invoice creation failed: ${getErrorMessage(error)}`,
				status: "failed",
			});
			throw new SlickpayUnavailableError(error);
		}

		const pending = await this.payments.updateIfStatus(row.id, "created", {
			invoiceId: invoice.id,
			paymentUrl: invoice.url,
			status: "pending",
		});

		// Only the sweep moves a "created" row, after 1 h. Never hand out a URL for a closed row.
		if (!pending) {
			throw new Error(
				`SlickPay payment ${row.id} left "created" before its invoice was saved`,
			);
		}

		return { paymentId: row.id, url: invoice.url };
	}

	/**
	 * Returns the open Starter pass row of the buyer, or inserts a new "created" row. Call it under the owner lock.
	 * Card checkouts insert their attempt under the same lock, so two tabs or two team admins see each other.
	 * Throws 409 when the pool does not need the pass, or another payment of the pass is open or in flight.
	 */
	private async reserveStarterPass(
		owner: CreditOwner,
		input: InsertSlickpayPaymentInput,
		tx: BillingCheckoutAttemptTransaction,
	): Promise<SlickpayPaymentRow> {
		// The 250 DA price is only for a pool that cannot spend yet. The lock also serializes the pass grant.
		if (!(await this.credits.getSettledBalance(owner)).starterPassRequired) {
			throw new StarterPassNotAvailableError();
		}

		const open = await this.payments.findOpenStarterPasses(
			owner,
			new Date(Date.now() - STARTER_PASS_HOLD_MS),
			tx,
		);
		// Only the buyer can open the return page of a row, so another team admin never gets this URL.
		const reusable = open.find(
			(payment) =>
				payment.userId === input.userId &&
				payment.status === "pending" &&
				payment.paymentUrl !== null,
		);

		if (reusable) {
			return reusable;
		}

		if (open.some((payment) => payment.status === "pending")) {
			throw new StarterPassSlickpayOpenError();
		}

		// A "created" row has its invoice call in flight. A "paid" row waits for its grant.
		if (open.length > 0) {
			throw new BillingCheckoutPendingError();
		}

		// expireOpenTopupSessions ran before the lock. A card page that is still open, or in flight, stays payable.
		const cardAttempts = await this.checkoutAttempts.findOpenForOwner(
			owner,
			"topup",
			tx,
		);

		if (cardAttempts.some(isBlockingTopupAttempt)) {
			throw new BillingCheckoutPendingError();
		}

		return this.insertWithinLimit(input, tx);
	}

	/**
	 * Inserts a "created" row when the buyer started fewer than 5 checkouts in 10 minutes. Call it under a lock.
	 * A top-up uses the user lock. A Starter pass uses the owner lock, which is the same key for a personal pool.
	 */
	private async insertWithinLimit(
		input: InsertSlickpayPaymentInput,
		tx: BillingCheckoutAttemptTransaction,
	): Promise<SlickpayPaymentRow> {
		// LIMIT: a team Starter pass counts under the team lock, so a parallel top-up of the same buyer can pass the limit by one. Upgrade: take the user lock in the same transaction.
		const recent = await this.payments.countByUserSince(
			input.userId,
			new Date(Date.now() - CHECKOUT_WINDOW_MS),
			tx,
		);

		if (recent >= CHECKOUT_LIMIT) {
			throw new SlickpayTooManyCheckoutsError();
		}

		return this.payments.insert(input, tx);
	}

	/**
	 * The return page calls it until the payment is final. It asks SlickPay at most once every 2 s per row.
	 * Only this route asks SlickPay about an expired row: a buyer who paid late comes back here.
	 */
	async confirm(
		user: Pick<AuthUser, "id">,
		paymentId: string,
	): Promise<SlickpayPaymentView> {
		const row = await this.payments.findById(paymentId);

		// Security: a user reads only own payments. 404, not 403, hides that the id exists.
		if (!row || row.userId !== user.id) {
			throw new NotFoundException();
		}

		// Security: an invoice check sends one SlickPay call with our merchant key. Too many calls can make SlickPay block the key.
		// The claim allows one check per row every 2 s, also for parallel requests.
		const checkable =
			row.status === "pending" || row.status === "expired"
				? await this.payments.claimInvoiceCheck(
						row.id,
						new Date(Date.now() - INVOICE_CHECK_INTERVAL_MS),
					)
				: row;

		if (!checkable) {
			return toView(row);
		}

		try {
			return toView(await this.refresh(checkable));
		} catch (error) {
			// SlickPay or the database failed. The web polls again, so answer with the saved state.
			this.logger.warn(
				`SlickPay payment ${row.id} refresh failed: ${getErrorMessage(error)}`,
			);

			return toView((await this.payments.findById(row.id)) ?? row);
		}
	}

	/**
	 * Moves one row forward: asks SlickPay about a pending or expired invoice, fulfills a paid row, and closes old rows.
	 * Confirm and the sweep call it. Every step is safe to repeat. Throws when SlickPay cannot answer.
	 */
	async refresh(row: SlickpayPaymentRow): Promise<SlickpayPaymentRow> {
		const ageMs = Date.now() - row.createdAt.getTime();

		switch (row.status) {
			case "created":
				// The process stopped before the invoice existed. The buyer never got a URL, so "failed" is safe.
				return ageMs > CREATED_TIMEOUT_MS
					? this.move(row, {
							lastError: "The invoice was not created within 1 hour",
							status: "failed",
						})
					: row;
			// The sweep lists only open rows, so only confirm sends an expired row here.
			case "pending":
			case "expired":
				return this.refreshUnpaid(row, ageMs);
			case "paid":
				return this.fulfill(row);
			case "fulfilled":
			case "failed":
				return row;
		}
	}

	/** Refreshes the oldest open rows. One failed row does not stop the run. */
	async sweep(): Promise<SlickpayPaymentSweepResult> {
		// LIMIT: 50 rows per run in sequence. At 2 s per SlickPay call, a run fits in maxDuration 120 s. Upgrade: refresh rows in parallel.
		const rows = await this.payments.listOpen(SWEEP_BATCH_SIZE);
		const result: SlickpayPaymentSweepResult = {
			checked: rows.length,
			errors: 0,
			fulfilled: 0,
			stillPaid: 0,
		};

		for (const row of rows) {
			try {
				const refreshed = await this.refresh(row);

				if (refreshed.status === "fulfilled") {
					result.fulfilled += 1;
				}

				if (refreshed.status === "paid") {
					result.stillPaid += 1;
				}
			} catch (error) {
				result.errors += 1;
				this.logger.error(
					`SlickPay payment ${row.id} refresh failed and stays open: ${getErrorMessage(error)}`,
				);
			}
		}

		return result;
	}

	/** Asks SlickPay about the invoice of a pending or expired row. A "paid" answer always wins over "expired". */
	private async refreshUnpaid(
		row: SlickpayPaymentRow,
		ageMs: number,
	): Promise<SlickpayPaymentRow> {
		if (!this.slickpay) {
			throw new SlickpayNotConfiguredError();
		}

		let paid: boolean;

		try {
			paid = isSlickpayInvoicePaid(
				await this.slickpay.getInvoice(requireInvoiceId(row)),
			);
		} catch (error) {
			// The write also moves the row to the back of the sweep queue.
			await this.move(row, {
				lastError: `Invoice check failed: ${getErrorMessage(error)}`,
			});
			throw error;
		}

		if (paid) {
			const paidChanges: SlickpayPaymentChanges = {
				lastError: null,
				paidAt: new Date(),
				status: "paid",
			};
			let paidRow = await this.move(row, paidChanges);

			// A parallel sweep can write "expired" after its own "not paid" answer. SlickPay has the money, so move it on.
			if (paidRow.status === "expired") {
				paidRow = await this.move(paidRow, paidChanges);
			}

			return paidRow.status === "paid" ? this.fulfill(paidRow) : paidRow;
		}

		// Expire only right after a "not paid" answer. Confirm still asks SlickPay later, so a late payment is never lost.
		if (ageMs > PENDING_EXPIRY_MS) {
			return this.move(row, { status: "expired" });
		}

		// The write marks the row as checked and moves it to the back of the sweep queue.
		return this.move(row, { lastError: null });
	}

	/**
	 * Tops up the wallet that a paid row buys, then marks the row fulfilled.
	 * On a refusal the row stays "paid" with last_error, and the next refresh tries again.
	 */
	private async fulfill(row: SlickpayPaymentRow): Promise<SlickpayPaymentRow> {
		try {
			return await this.grantTopup(row);
		} catch (error) {
			const message = getErrorMessage(error);

			// SlickPay has the money, but the buyer has no credits. The sweep retries every 5 min, so report a new error once.
			if (message !== row.lastError) {
				Sentry.captureException(error, {
					tags: { slickpayPaymentId: row.id },
				});
			}

			this.logger.error(
				`SlickPay payment ${row.id} is paid but not fulfilled: ${message}`,
			);

			return this.move(row, { lastError: message });
		}
	}

	/**
	 * One transaction under the owner lock: the ledger top-up, one receipt, and the row set to "fulfilled".
	 * Every write has a key from the row id, so the sweep and confirm can run it in parallel and grant once.
	 */
	private async grantTopup(
		row: SlickpayPaymentRow,
	): Promise<SlickpayPaymentRow> {
		const invoiceId = requireInvoiceId(row);
		const owner = ownerFromIds(row.userId, row.organizationId);

		return this.ownerLock.withOwnerLock(owner, async (tx) => {
			const locked = await this.payments.findById(row.id, tx);

			// A parallel refresh fulfilled the row while this one waited for the lock, or an admin closed it.
			if (locked?.status !== "paid") {
				if (!locked) {
					throw new Error(`SlickPay payment ${row.id} disappeared`);
				}

				return locked;
			}

			// A row from before pricing v8 has no credits. Old code can have granted it as a manual plan.
			if (locked.credits === null) {
				const recorded = await this.findRecordedPayment(
					locked.id,
					invoiceId,
					tx,
				);

				if (recorded) {
					return this.markFulfilled(locked, recorded.subscriptionId, tx);
				}
			}

			const grant = slickpayTopupGrant(locked);

			await this.credits.topup(
				owner,
				grant.centiCredits,
				{
					idempotencyKey: `slickpay-topup:${locked.id}`,
					meta: {
						amountUsdCents: grant.amountUsdCents,
						invoiceId,
						reason: "slickpay_topup",
						slickpayPaymentId: locked.id,
					},
				},
				tx,
			);
			const receipt = await this.receipts.insertIfAbsent(
				{
					// DZD has 2 decimals in ISO 4217, so the minor unit is the centime.
					amountCents: locked.amountDzd * 100,
					amountUsdCents: grant.amountUsdCents,
					credits: grant.centiCredits,
					currency: "dzd",
					method: "slickpay",
					organizationId: locked.organizationId,
					paidAt: locked.paidAt ?? new Date(),
					provider: "slickpay",
					providerReference: `slickpay:${locked.id}`,
					reference: invoiceId,
					userId: locked.userId,
				},
				tx,
			);

			// Any paid SlickPay top-up proves a real payer. The pass goes to the pool, never to the buyer of a team row.
			// A replay finds the receipt and writes no pass, so a pass that an admin reverse revoked does not come back.
			if (receipt) {
				await this.starterPasses.grantIfAbsent(
					owner,
					{ receiptId: receipt.id, source: "slickpay" },
					tx,
				);
			}

			await this.lifecycleEvents.enqueue(
				{
					event: "payment_completed",
					idempotencyKey: lifecycleEventIdempotencyKey(
						"payment_completed",
						locked.userId,
					),
					payload: { interval: "topup" },
					userId: locked.userId,
				},
				tx,
			);

			return this.markFulfilled(locked, null, tx);
		});
	}

	/** Sets a "paid" row to "fulfilled" inside the grant transaction. Throws, and so rolls back the grant, when the row moved. */
	private async markFulfilled(
		row: SlickpayPaymentRow,
		subscriptionId: string | null,
		tx: SubscriptionCreditsTransaction,
	): Promise<SlickpayPaymentRow> {
		const fulfilled = await this.payments.updateIfStatus(
			row.id,
			"paid",
			{
				fulfilledAt: new Date(),
				lastError: null,
				status: "fulfilled",
				...(subscriptionId ? { subscriptionId } : {}),
			},
			tx,
		);

		// Old code in the deploy window writes the status without the owner lock. Never keep a grant for a moved row.
		if (!fulfilled) {
			throw new Error(
				`SlickPay payment ${row.id} left "paid" during the top-up`,
			);
		}

		return fulfilled;
	}

	/**
	 * The old plan payment that already funds this SlickPay payment, or null.
	 * Old grant and renew used the row id as key. An admin who resolved the row by hand used the invoice id as reference.
	 */
	private async findRecordedPayment(
		slickpayPaymentId: string,
		invoiceId: string,
		tx: SubscriptionCreditsTransaction,
	): Promise<ManualSubscriptionPaymentRow | null> {
		return (
			(await this.manualPayments.findByIdempotencyKey(slickpayPaymentId, tx)) ??
			(await this.manualPayments.findSlickpayByReference(invoiceId, tx))
		);
	}

	/**
	 * Writes `changes` only while the row still has the status it had when it was read.
	 * When a parallel refresh moved the row first, this writes nothing and returns the current row.
	 */
	private async move(
		row: SlickpayPaymentRow,
		changes: SlickpayPaymentChanges,
	): Promise<SlickpayPaymentRow> {
		const moved = await this.payments.updateIfStatus(
			row.id,
			row.status,
			changes,
		);

		if (moved) {
			return moved;
		}

		const current = await this.payments.findById(row.id);

		if (!current) {
			throw new Error(`SlickPay payment ${row.id} disappeared`);
		}

		return current;
	}
}

// Only a "pending" row gets an invoice id. Only a pending row, or an expired one that was pending, becomes "paid". A null here is a data bug.
function requireInvoiceId(row: SlickpayPaymentRow): string {
	if (row.invoiceId === null) {
		throw new Error(
			`SlickPay payment ${row.id} has status ${row.status} but no invoice id`,
		);
	}

	return row.invoiceId;
}

// The workspace header selects whose money it is. Null means the personal wallet of the caller.
function resolveBillingOrganizationId(
	workspace: WorkspaceContext | undefined,
): string | null {
	// Another user's personal workspace: the owner's pool pays, and billing is owner-only.
	if (workspace?.kind === "shared-personal") {
		throw new WorkspacePermissionDeniedError();
	}

	return workspace?.kind === "org" ? workspace.organizationId : null;
}

/**
 * The credits of a paid row. A pricing v8 row stores them at checkout.
 * A row from before v8 gets the larger of its plan credits and 10 credits per USD of its DZD amount (D4).
 * Throws when the result is zero, so a row never fulfils with no credits.
 */
export function slickpayTopupGrant(
	row: SlickpayPaymentRow,
): SlickpayTopupGrant {
	if (row.credits !== null) {
		return { amountUsdCents: row.amountUsdCents, centiCredits: row.credits };
	}

	// tier_credits is whole credits per month. A yearly row paid for 12 months.
	const planCentiCredits =
		row.tierCredits === null
			? 0
			: row.tierCredits *
				CENTI_CREDITS_PER_CREDIT *
				(row.interval === "year" ? MONTHS_PER_YEAR : 1);
	// dzd_per_usd_rate is centi-DZD per 1 USD, so USD = amount_dzd * 100 / rate.
	// Floor: a fraction of a centi-credit is never granted.
	// No volume bonus here: the payer of an old row paid before the bonus existed, so the flat rate stays.
	const dzdCentiCredits = Math.floor(
		(row.amountDzd * 100 * TOPUP_CREDITS_PER_USD * CENTI_CREDITS_PER_CREDIT) /
			row.dzdPerUsdRate,
	);
	const centiCredits = Math.max(planCentiCredits, dzdCentiCredits);
	const amountUsdCents = Math.round(
		(row.amountDzd * 100 * 100) / row.dzdPerUsdRate,
	);

	if (centiCredits <= 0) {
		throw new Error(`SlickPay payment ${row.id} would grant zero credits`);
	}

	return {
		amountUsdCents: amountUsdCents > 0 ? amountUsdCents : null,
		centiCredits,
	};
}

function toView(row: SlickpayPaymentRow): SlickpayPaymentView {
	return {
		amountDzd: row.amountDzd,
		// amount_usd_cents holds USD cents. Null on a row from before pricing v8.
		amountUsd: row.amountUsdCents === null ? null : row.amountUsdCents / 100,
		credits: row.credits === null ? null : centiCreditsToCredits(row.credits),
		id: row.id,
		interval: row.interval,
		plan: row.plan,
		status: row.status,
		subscriptionId: row.subscriptionId,
		tierCredits: row.tierCredits,
	};
}
