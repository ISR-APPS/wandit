/**
 * SlickPay checkout for buyers in Algeria: one DZD card payment buys one period of one plan.
 * SlickpayBillingController calls localPricing, startCheckout, and confirm. The Trigger.dev sweep calls sweep.
 * It calls the SlickPay client, the slickpay_payments repository, and ManualSubscriptionsService (grant or renew).
 */
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AdminGrantManualSubscriptionInput,
	type AdminManualPaymentInput,
	type AdminManualSubscriptionDetail,
	type AdminRenewManualSubscriptionInput,
	type BillingInterval,
	type BillingLocalPricingResponse,
	type BillingPlanId,
	creditTierSchema,
	dzdPriceFor,
	isNewSubscriptionPlan,
	isSlickpayInvoicePaid,
	priceUsdFor,
	type SlickpayCreateInvoiceResponse,
	type SlickpayPaymentView,
	type StartSlickpayCheckoutBody,
	type StartSlickpayCheckoutResponse,
	SUBSCRIPTION_PROVIDERS,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import {
	type CreditOwner,
	orgOwner,
	ownerFromIds,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { OrganizationsDisabledError } from "../../../settings/domain/errors/organizations-disabled.error";
import { WorkspaceNotSupportedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import { ManualSubscriptionUnsupportedError } from "../../domain/errors/manual-billing.errors";
import { PaymentPastDueError } from "../../domain/errors/payment-past-due.error";
import {
	SlickpayNotConfiguredError,
	SlickpayTooManyCheckoutsError,
	SlickpayUnavailableError,
} from "../../domain/errors/slickpay.errors";
import { BillingCheckoutAttemptsRepository } from "../../infrastructure/persistence/billing-checkout-attempts.repository";
import {
	type ManualSubscriptionPaymentRow,
	ManualSubscriptionPaymentsRepository,
} from "../../infrastructure/persistence/manual-subscription-payments.repository";
import {
	type SlickpayPaymentChanges,
	type SlickpayPaymentRow,
	SlickpayPaymentsRepository,
} from "../../infrastructure/persistence/slickpay-payments.repository";
import {
	type SubscriptionRow,
	SubscriptionsRepository,
} from "../../infrastructure/persistence/subscriptions.repository";
import {
	SLICKPAY_CLIENT,
	type SlickpayClient,
} from "../../infrastructure/slickpay/slickpay.client";
import { ManualSubscriptionsService } from "./manual-subscriptions.service";

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

// Copy of the private map in email/templates/auth-email-templates.ts. The invoice line shows it.
const PLAN_NAMES = {
	starter: "Starter",
	pro: "Pro",
	business: "Business",
} as const satisfies Record<BillingPlanId, string>;

/** Counts of one sweep run. The Trigger.dev task logs and returns them. */
export type SlickpayPaymentSweepResult = {
	/** Open rows that the run read. */
	checked: number;
	/** Rows that the run fulfilled. */
	fulfilled: number;
	/** Rows still "paid" after the run: SlickPay has the money, but no plan is granted. See last_error. */
	stillPaid: number;
	/** Rows whose refresh threw, for example on a SlickPay timeout. The next run tries them again. */
	errors: number;
};

/** The ManualSubscriptionsService calls that fulfill a payment. The service reads only the subscription id of the answer. */
type ManualSubscriptionWrites = {
	grant(
		adminId: string,
		input: AdminGrantManualSubscriptionInput,
	): Promise<Pick<AdminManualSubscriptionDetail, "id">>;
	renew(
		adminId: string,
		subscriptionId: string,
		input: AdminRenewManualSubscriptionInput,
	): Promise<Pick<AdminManualSubscriptionDetail, "id">>;
};

/** The plan, tier, and cycle that one SlickPay payment buys. */
type PlanSelection = {
	plan: BillingPlanId;
	/** Whole display credits per period: the tier identity, as in `subscriptions.tier_credits`. */
	tierCredits: number;
	interval: BillingInterval;
};

/** Owns the SlickPay payment states. A paid row becomes a provider = "manual" subscription, never a Stripe one. */
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
		@Inject(ManualSubscriptionsService)
		private readonly manualSubscriptions: ManualSubscriptionWrites,
		@Inject(ManualSubscriptionPaymentsRepository)
		private readonly manualPayments: Pick<
			ManualSubscriptionPaymentsRepository,
			"findByIdempotencyKey" | "findSlickpayByReference"
		>,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: Pick<
			SubscriptionsRepository,
			"findActiveByOwner"
		>,
		@Inject(BillingCheckoutAttemptsRepository)
		private readonly checkoutAttempts: Pick<
			BillingCheckoutAttemptsRepository,
			"findOpenForOwner" | "withUserLock"
		>,
		@Inject(ProductSettingsService)
		private readonly productSettings: Pick<ProductSettingsService, "get">,
	) {}

	/** The answer of GET local-pricing. `countryCode` comes from the edge headers of the visitor request. */
	async localPricing(
		countryCode: string | null,
	): Promise<BillingLocalPricingResponse> {
		// Product rule: only visitors in Algeria see DZD prices and the SlickPay tab.
		if (!this.slickpay || countryCode !== "DZ") {
			return { slickpay: null };
		}

		const settings = await this.productSettings.get();

		// product_settings stores centi-DZD: 27000 is 270.00 DZD per 1 USD.
		return { slickpay: { dzdPerUsdRate: settings.dzdPerUsdRate / 100 } };
	}

	/**
	 * Inserts a payment row and creates its SlickPay invoice. The web sends the buyer to the answered URL.
	 * Refuses early what fulfill refuses later, so a buyer never pays for a plan that the API cannot grant.
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
		const scope = resolveBillingScope(user, workspace);

		if (scope.organizationId && !settings.organizationsEnabled) {
			throw new OrganizationsDisabledError();
		}

		assertPlanMatchesScope(body.plan, scope.organizationId);
		// New subscriptions exclude Starter because only current subscribers receive its renewal offer.
		if (!isNewSubscriptionPlan(body.plan)) {
			throw new BadRequestException(
				"The Starter plan is only offered to current subscribers",
			);
		}

		await this.assertOwnerCanPay(scope.owner, body);

		// product_settings stores centi-DZD: 27000 is 270.00 DZD per 1 USD.
		const amountDzd = dzdPriceFor(
			priceUsdFor(body.plan, body.tierCredits, body.interval),
			settings.dzdPerUsdRate / 100,
		);
		// The user lock makes the count and the insert one step, so parallel requests cannot pass the limit.
		const row = await this.checkoutAttempts.withUserLock(
			user.id,
			async (tx) => {
				const recent = await this.payments.countByUserSince(
					user.id,
					new Date(Date.now() - CHECKOUT_WINDOW_MS),
					tx,
				);

				if (recent >= CHECKOUT_LIMIT) {
					throw new SlickpayTooManyCheckoutsError();
				}

				return this.payments.insert(
					{
						amountDzd,
						dzdPerUsdRate: settings.dzdPerUsdRate,
						interval: body.interval,
						organizationId: scope.organizationId,
						plan: body.plan,
						tierCredits: body.tierCredits,
						userId: user.id,
					},
					tx,
				);
			},
		);

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
				itemName: `Wandit ${PLAN_NAMES[body.plan]} · ${body.tierCredits} credits · ${body.interval === "year" ? "yearly" : "monthly"}`,
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
	 * Grants or renews the manual subscription that a paid row buys, then marks the row fulfilled.
	 * On a refusal the row stays "paid" with last_error, and the next refresh tries again.
	 */
	private async fulfill(row: SlickpayPaymentRow): Promise<SlickpayPaymentRow> {
		try {
			const subscriptionId = await this.grantOrRenew(row);

			return await this.move(row, {
				fulfilledAt: new Date(),
				lastError: null,
				status: "fulfilled",
				subscriptionId,
			});
		} catch (error) {
			const message = getErrorMessage(error);

			// SlickPay has the money, but the buyer has no plan. The sweep retries every 5 min, so report a new error once.
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

	/** Returns the id of the subscription that this payment funds. Every path is safe to repeat. */
	private async grantOrRenew(row: SlickpayPaymentRow): Promise<string> {
		const invoiceId = requireInvoiceId(row);
		const recorded = await this.findRecordedPayment(row.id, invoiceId);

		if (recorded) {
			return recorded.subscriptionId;
		}

		const current = await this.subscriptions.findActiveByOwner(
			ownerFromIds(row.userId, row.organizationId),
		);

		// A SlickPay payment cannot replace a Stripe subscription or change a manual plan. An admin decides.
		if (current && !isSameManualPlan(current, row)) {
			throw new Error(
				`The owner has a ${current.provider} subscription ${current.id} (${current.plan}, ${current.pendingTierCredits ?? current.tierCredits} credits, ${current.interval}). An admin must resolve this payment.`,
			);
		}

		const payment: AdminManualPaymentInput = {
			// DZD has 2 decimals in ISO 4217, so the minor unit is the centime.
			amountMinor: row.amountDzd * 100,
			currency: "DZD",
			method: "slickpay",
			note: `SlickPay invoice ${invoiceId}`,
			reference: invoiceId,
		};

		try {
			if (!current) {
				// adminId is the payer: manual_subscription_payments.recorded_by_user_id is a NOT NULL FK to user.
				const granted = await this.manualSubscriptions.grant(row.userId, {
					idempotencyKey: row.id,
					interval: row.interval,
					organizationId: row.organizationId,
					payment,
					plan: row.plan,
					tierCredits: creditTierSchema.parse(row.tierCredits),
					userId: row.userId,
				});

				return granted.id;
			}

			// adminId is the payer, for the same reason as the grant above.
			await this.manualSubscriptions.renew(row.userId, current.id, {
				idempotencyKey: row.id,
				payment,
			});

			return current.id;
		} catch (error) {
			// A parallel refresh can fulfill the same row first. Its payment row then has this key.
			const raced = await this.manualPayments.findByIdempotencyKey(row.id);

			if (raced) {
				return raced.subscriptionId;
			}

			throw error;
		}
	}

	/**
	 * The manual payment that already funds this SlickPay payment, or null.
	 * grant and renew use the row id as key. An admin who resolves the row by hand uses the invoice id as reference.
	 */
	private async findRecordedPayment(
		slickpayPaymentId: string,
		invoiceId: string,
	): Promise<ManualSubscriptionPaymentRow | null> {
		return (
			(await this.manualPayments.findByIdempotencyKey(slickpayPaymentId)) ??
			(await this.manualPayments.findSlickpayByReference(invoiceId))
		);
	}

	/** The checks of fulfill, before the buyer pays. */
	private async assertOwnerCanPay(
		owner: CreditOwner,
		selection: PlanSelection,
	): Promise<void> {
		const current = await this.subscriptions.findActiveByOwner(owner);

		// Same answers as the Stripe checkout (BillingService.throwCheckoutBlocked).
		if (current && current.provider !== SUBSCRIPTION_PROVIDERS.manual) {
			if (current.status === "past_due") {
				throw new PaymentPastDueError();
			}

			throw new ActiveSubscriptionExistsError();
		}

		// A SlickPay payment renews only the same plan, tier, and cycle. A change goes through an admin.
		if (current && !isSameManualPlan(current, selection)) {
			throw new ManualSubscriptionUnsupportedError();
		}

		const openCheckouts = await this.checkoutAttempts.findOpenForOwner(
			owner,
			"subscription",
		);

		// grant refuses while a Stripe checkout is open, so the buyer must not pay now.
		if (openCheckouts.length > 0) {
			throw new ConflictException({
				code: "BILLING_CHECKOUT_PENDING",
				message: "A billing checkout is already pending",
			});
		}
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

/**
 * True when a payment for `selection` renews `subscription`.
 * renew applies the pending tier, so the pending tier counts when it is set.
 */
function isSameManualPlan(
	subscription: SubscriptionRow,
	selection: PlanSelection,
): boolean {
	return (
		subscription.provider === SUBSCRIPTION_PROVIDERS.manual &&
		subscription.plan === selection.plan &&
		(subscription.pendingTierCredits ?? subscription.tierCredits) ===
			selection.tierCredits &&
		subscription.interval === selection.interval
	);
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

// Copy of ManualSubscriptionRequestsService.resolveBillingScope: the workspace header selects whose money it is.
function resolveBillingScope(
	user: Pick<AuthUser, "id">,
	workspace: WorkspaceContext | undefined,
): { organizationId: string | null; owner: CreditOwner } {
	if (workspace?.kind !== "org") {
		return { organizationId: null, owner: userOwner(user.id) };
	}

	return {
		organizationId: workspace.organizationId,
		owner: orgOwner(workspace.organizationId),
	};
}

// Product rule: a personal workspace buys Starter or Pro, an organization workspace buys Business.
function assertPlanMatchesScope(
	plan: BillingPlanId,
	organizationId: string | null,
): void {
	const supported = organizationId
		? plan === "business"
		: plan === "starter" || plan === "pro";

	if (!supported) {
		throw new WorkspaceNotSupportedError(
			organizationId
				? "Organization workspaces support the Business plan only"
				: "Personal workspaces support the Starter and Pro plans only",
		);
	}
}

function toView(row: SlickpayPaymentRow): SlickpayPaymentView {
	return {
		amountDzd: row.amountDzd,
		id: row.id,
		interval: row.interval,
		plan: row.plan,
		status: row.status,
		subscriptionId: row.subscriptionId,
		tierCredits: row.tierCredits,
	};
}
