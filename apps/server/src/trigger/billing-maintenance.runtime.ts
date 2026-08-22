import { logger as triggerLogger } from "@trigger.dev/sdk";
import type { createDb } from "@wandit/db";

import type { AnalyticsService } from "../infrastructure/analytics/analytics.service";
import { AffiliateApprovalService } from "../modules/affiliates/application/services/affiliate-approval.service";
import { AffiliateAttributionService } from "../modules/affiliates/application/services/affiliate-attribution.service";
import { AffiliateClawbackService } from "../modules/affiliates/application/services/affiliate-clawback.service";
import { AffiliateCommissionService } from "../modules/affiliates/application/services/affiliate-commission.service";
import { AffiliateTokenService } from "../modules/affiliates/application/services/affiliate-token.service";
import { AffiliatesRepository } from "../modules/affiliates/infrastructure/persistence/affiliates.repository";
import { SignupGrantOutboxService } from "../modules/auth/application/services/signup-grant-outbox.service";
import { SignupGrantOutboxRepository } from "../modules/auth/infrastructure/persistence/signup-grant-outbox.repository";
import { BillingCustomerService } from "../modules/billing/application/services/billing-customer.service";
import { BillingWebhookRetryService } from "../modules/billing/application/services/billing-webhook-retry.service";
import { ManualSubscriptionsService } from "../modules/billing/application/services/manual-subscriptions.service";
import { PaymentRefundsService } from "../modules/billing/application/services/payment-refunds.service";
import { StripeEventRouter } from "../modules/billing/application/services/stripe-event-router.service";
import { StripeSubscriptionSyncService } from "../modules/billing/application/services/stripe-subscription-sync.service";
import { StripeWebhookProcessor } from "../modules/billing/application/services/stripe-webhook-processor.service";
import { SubscriptionCreditsService } from "../modules/billing/application/services/subscription-credits.service";
import { SubscriptionLifecycleService } from "../modules/billing/application/services/subscription-lifecycle.service";
import { SubscriptionRefillService } from "../modules/billing/application/services/subscription-refill.service";
import { BillingCheckoutAttemptsRepository } from "../modules/billing/infrastructure/persistence/billing-checkout-attempts.repository";
import { BillingCreditLedgerRepository } from "../modules/billing/infrastructure/persistence/billing-credit-ledger.repository";
import { BillingCustomersRepository } from "../modules/billing/infrastructure/persistence/billing-customers.repository";
import { BillingPaymentAdjustmentsRepository } from "../modules/billing/infrastructure/persistence/billing-payment-adjustments.repository";
import { BillingWebhookEventsRepository } from "../modules/billing/infrastructure/persistence/billing-webhook-events.repository";
import { ManualSubscriptionPaymentsRepository } from "../modules/billing/infrastructure/persistence/manual-subscription-payments.repository";
import { ManualSubscriptionRequestsRepository } from "../modules/billing/infrastructure/persistence/manual-subscription-requests.repository";
import { OrganizationBillingCustomersRepository } from "../modules/billing/infrastructure/persistence/organization-billing-customers.repository";
import { SubscriptionCreditsRepository } from "../modules/billing/infrastructure/persistence/subscription-credits.repository";
import { SubscriptionStateEventsRepository } from "../modules/billing/infrastructure/persistence/subscription-state-events.repository";
import { SubscriptionsRepository } from "../modules/billing/infrastructure/persistence/subscriptions.repository";
import { StripeProvider } from "../modules/billing/infrastructure/stripe/stripe.provider";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
import { DomainsService } from "../modules/domains/application/services/domains.service";
import type { DomainTaskDispatcher } from "../modules/domains/domain/ports/domain-task-dispatcher.port";
import { CustomHostnameService } from "../modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../modules/domains/infrastructure/cloudflare/domain-routing.service";
import { NamecomProvider } from "../modules/domains/infrastructure/namecom/namecom.provider";
import { DomainsRepository } from "../modules/domains/infrastructure/persistence/domains.repository";
import {
	recoverDomainPurchaseTask,
	triggerDomainConfigurationTask,
	triggerDomainPurchaseTask,
} from "../modules/domains/infrastructure/trigger/trigger-domain-task-dispatcher.service";
import { DomainRegistrationFulfillment } from "../modules/orders/application/fulfillment/domain-registration.fulfillment";
import { OrderFulfillmentRegistry } from "../modules/orders/application/services/order-fulfillment.registry";
import { OrderRefundsService } from "../modules/orders/application/services/order-refunds.service";
import { OrdersService } from "../modules/orders/application/services/orders.service";
import type { OrderRefundDispatcher } from "../modules/orders/domain/ports/order-refund-dispatcher.port";
import { PaymentOrdersRepository } from "../modules/orders/infrastructure/persistence/payment-orders.repository";
import {
	recoverOrderRefundTask,
	triggerOrderRefundTask,
} from "../modules/orders/infrastructure/trigger/trigger-order-refund-dispatcher.service";
import { ProductSettingsService } from "../modules/settings/application/services/product-settings.service";
import { ProductSettingsRepository } from "../modules/settings/infrastructure/persistence/product-settings.repository";
import { WorkspaceMembersRepository } from "../modules/workspaces/infrastructure/persistence/members.repository";
import { createTriggerModelPricing } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;
type TriggerAnalytics = Pick<AnalyticsService, "capture">;

export function createSubscriptionRefillRuntime(db: TriggerDatabase) {
	const core = createPaymentCore(db);

	return {
		refills: new SubscriptionRefillService(
			new SubscriptionCreditsRepository(db),
			core.credits,
			core.paymentRefunds,
		),
	};
}

export function createManualBillingRuntime(db: TriggerDatabase) {
	const core = createPaymentCore(db);
	const subscriptions = new SubscriptionsRepository(db);
	const subscriptionCredits = new SubscriptionCreditsRepository(db);
	const refills = new SubscriptionRefillService(
		subscriptionCredits,
		core.credits,
		core.paymentRefunds,
	);

	return {
		manualSubscriptions: new ManualSubscriptionsService(
			subscriptions,
			subscriptionCredits,
			core.credits,
			refills,
			new ManualSubscriptionPaymentsRepository(db),
			new ManualSubscriptionRequestsRepository(db),
			new SubscriptionStateEventsRepository(db),
			new BillingCheckoutAttemptsRepository(db),
			new ProductSettingsService(new ProductSettingsRepository(db)),
		),
	};
}

export function createAffiliateMaintenanceRuntime(db: TriggerDatabase) {
	const core = createAffiliateCore(db);

	return {
		approval: new AffiliateApprovalService(core.affiliates),
		attribution: new AffiliateAttributionService(
			core.affiliates,
			new AffiliateTokenService(),
			core.commission,
			undefined,
		),
		commission: core.commission,
	};
}

export function createSignupGrantRuntime(db: TriggerDatabase) {
	return {
		outbox: new SignupGrantOutboxService(
			new SignupGrantOutboxRepository(db),
			createCredits(db),
		),
	};
}

export function createModelPriceRefreshRuntime(db: TriggerDatabase) {
	return { modelPricing: createTriggerModelPricing(db) };
}

/**
 * Composes the complete webhook route graph, including order fulfillment and
 * refund dispatch. A retry therefore re-runs the same entitlement and
 * financial-state checks as the inline webhook path; it is not a reduced
 * dead-letter-only implementation.
 */
export function createBillingWebhookRuntime(
	db: TriggerDatabase,
	analytics: TriggerAnalytics,
) {
	const payment = createPaymentCore(db);
	const affiliate = createAffiliateCore(db, payment.stripe);
	const billingCustomers = affiliate.billingCustomers;
	const subscriptions = new SubscriptionsRepository(db);
	const subscriptionCreditsRepository = new SubscriptionCreditsRepository(db);
	const checkoutAttempts = new BillingCheckoutAttemptsRepository(db);
	const refills = new SubscriptionRefillService(
		subscriptionCreditsRepository,
		payment.credits,
		payment.paymentRefunds,
	);
	const subscriptionCredits = new SubscriptionCreditsService(
		billingCustomers,
		subscriptions,
		payment.credits,
		payment.stripe,
		payment.paymentRefunds,
		subscriptionCreditsRepository,
		refills,
		checkoutAttempts,
		new OrganizationBillingCustomersRepository(db),
	);
	const subscriptionSync = new StripeSubscriptionSyncService(
		billingCustomers,
		subscriptions,
		payment.stripe,
		new OrganizationBillingCustomersRepository(db),
	);
	const orderReconciler = createOrderReconciler(
		db,
		payment,
		billingCustomers,
		affiliate.affiliates,
	);
	const subscriptionLifecycle = new SubscriptionLifecycleService(
		new SubscriptionStateEventsRepository(db),
		new BillingPaymentAdjustmentsRepository(db),
		subscriptions,
		billingCustomers,
		new OrganizationBillingCustomersRepository(db),
	);
	const router = new StripeEventRouter(
		billingCustomers,
		new OrganizationBillingCustomersRepository(db),
		subscriptionSync,
		subscriptionCredits,
		payment.paymentRefunds,
		checkoutAttempts,
		orderReconciler,
		affiliate.commission,
		affiliate.clawback,
		subscriptionLifecycle,
	);
	const events = new BillingWebhookEventsRepository(db);
	const processor = new StripeWebhookProcessor(
		events,
		router,
		analytics as AnalyticsService,
	);

	return { retry: new BillingWebhookRetryService(events, processor) };
}

function createPaymentCore(db: TriggerDatabase) {
	const credits = createCredits(db);
	const stripe = new StripeProvider();
	const paymentOrders = new PaymentOrdersRepository(db);
	const domains = new DomainsRepository(db);
	const orderRefunds = new OrderRefundsService(paymentOrders, domains);
	const paymentRefunds = new PaymentRefundsService(
		new BillingCreditLedgerRepository(db),
		credits,
		orderRefunds,
		stripe,
	);

	return {
		credits,
		domains,
		orderRefunds,
		paymentOrders,
		paymentRefunds,
		stripe,
	};
}

function createAffiliateCore(
	db: TriggerDatabase,
	stripe = new StripeProvider(),
) {
	const affiliates = new AffiliatesRepository(db);
	const billingCustomers = new BillingCustomersRepository(db);
	const clawback = new AffiliateClawbackService(affiliates, stripe);
	const commission = new AffiliateCommissionService(
		affiliates,
		billingCustomers,
		new OrganizationBillingCustomersRepository(db),
		stripe,
		clawback,
	);

	return { affiliates, billingCustomers, clawback, commission, stripe };
}

function createCredits(db: TriggerDatabase): CreditsService {
	return new CreditsService(new CreditsRepository(db));
}

function createOrderReconciler(
	db: TriggerDatabase,
	payment: ReturnType<typeof createPaymentCore>,
	billingCustomers: BillingCustomersRepository,
	affiliates: AffiliatesRepository,
): OrdersService {
	const domainTasks: DomainTaskDispatcher = {
		assertAvailable() {},
		recoverPurchase: recoverDomainPurchaseTask,
		triggerConfiguration: triggerDomainConfigurationTask,
		triggerPurchase: triggerDomainPurchaseTask,
	};
	const orderRefunds: OrderRefundDispatcher = {
		assertAvailable() {},
		recoverRefund: recoverOrderRefundTask,
		triggerRefund: triggerOrderRefundTask,
	};
	const routing = new DomainRoutingService(payment.domains);
	const domainsService = new DomainsService(
		payment.domains,
		new NamecomProvider(),
		new CustomHostnameService(),
		routing,
		{
			error: (message: unknown) =>
				triggerLogger.error(String(message), { source: DomainsService.name }),
			log: (message: unknown) =>
				triggerLogger.info(String(message), { source: DomainsService.name }),
			warn: (message: unknown) =>
				triggerLogger.warn(String(message), { source: DomainsService.name }),
		},
		domainTasks,
	);
	const fulfillment = new DomainRegistrationFulfillment(
		payment.domains,
		domainTasks,
	);
	const fulfillmentRegistry = new OrderFulfillmentRegistry([fulfillment]);
	const billingCustomer = new BillingCustomerService(
		billingCustomers,
		payment.stripe,
		new OrganizationBillingCustomersRepository(db),
		new WorkspaceMembersRepository(db),
		affiliates,
	);

	return new OrdersService(
		payment.paymentOrders,
		domainsService,
		payment.domains,
		billingCustomer,
		billingCustomers,
		payment.stripe,
		fulfillmentRegistry,
		payment.orderRefunds,
		orderRefunds,
	);
}
