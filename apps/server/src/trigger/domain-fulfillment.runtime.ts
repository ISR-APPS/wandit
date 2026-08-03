import { logger as triggerLogger } from "@trigger.dev/sdk";
import type { createDb } from "@wandit/db";
import { Sentry } from "@wandit/observability/node";

import { CustomHostnameConfigurationStep } from "../modules/domains/application/fulfillment/custom-hostname-configuration.step";
import { CustomHostnameVerificationStep } from "../modules/domains/application/fulfillment/custom-hostname-verification.step";
import { DomainActivationStep } from "../modules/domains/application/fulfillment/domain-activation.step";
import { DomainConfigurationRunner } from "../modules/domains/application/fulfillment/domain-configuration-runner";
import type {
	DomainFulfillmentLogger,
	DomainPurchasePayload,
	DurableWait,
} from "../modules/domains/application/fulfillment/domain-fulfillment.contracts";
import { DomainFulfillmentReconcilerService } from "../modules/domains/application/fulfillment/domain-fulfillment-reconciler.service";
import { DomainFulfillmentStateService } from "../modules/domains/application/fulfillment/domain-fulfillment-state.service";
import { DomainPurchaseFailureFinalizer } from "../modules/domains/application/fulfillment/domain-purchase-failure-finalizer";
import { DomainPurchaseOrchestrator } from "../modules/domains/application/fulfillment/domain-purchase-orchestrator";
import { DomainRegistrationStep } from "../modules/domains/application/fulfillment/domain-registration.step";
import { DomainTerminalFailureStep } from "../modules/domains/application/fulfillment/domain-terminal-failure.step";
import { PurchasedDomainDnsStep } from "../modules/domains/application/fulfillment/purchased-domain-dns.step";
import { DomainRegistrarSyncService } from "../modules/domains/application/maintenance/domain-registrar-sync.service";
import { DomainRenewalNoticesService } from "../modules/domains/application/maintenance/domain-renewal-notices.service";
import { CustomHostnameService } from "../modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../modules/domains/infrastructure/cloudflare/domain-routing.service";
import { NamecomProvider } from "../modules/domains/infrastructure/namecom/namecom.provider";
import {
	DomainsRepository,
	type DomainTransaction,
} from "../modules/domains/infrastructure/persistence/domains.repository";
import { recoverDomainPurchaseTask } from "../modules/domains/infrastructure/trigger/trigger-domain-task-dispatcher.service";
import {
	PaymentOrdersRepository,
	type PaymentOrderTransaction,
} from "../modules/orders/infrastructure/persistence/payment-orders.repository";
import { triggerOrderRefundTask } from "../modules/orders/infrastructure/trigger/trigger-order-refund-dispatcher.service";

type Database = ReturnType<typeof createDb>;

type ConfigurationRuntimeOptions = {
	logger: DomainFulfillmentLogger;
	now?: () => Date;
	wait: DurableWait;
};

type PurchaseRuntimeOptions = ConfigurationRuntimeOptions & {
	fallbackOrigin: string;
};

/** Hand-wires the complete purchased-domain workflow for one task-local DB. */
export function createDomainPurchaseRuntime(
	db: Database,
	options: PurchaseRuntimeOptions,
) {
	const core = createDomainCore(db, options);
	const registrar = new NamecomProvider();
	const registration = new DomainRegistrationStep(registrar, core.state);
	const purchasedDns = new PurchasedDomainDnsStep(
		registrar,
		core.state,
		options.fallbackOrigin,
	);
	const customHostname = new CustomHostnameConfigurationStep(
		core.customHostnames,
		registrar,
		core.state,
		options.logger,
	);
	const purchase = new DomainPurchaseOrchestrator({
		configuration: core.configuration,
		customHostname,
		purchasedDns,
		registration,
		state: core.state,
		terminalFailure: core.terminalFailure,
	});

	return {
		configuration: core.configuration,
		finalizePurchase: (payload: DomainPurchasePayload, error: unknown) =>
			core.purchaseFailureFinalizer.execute(payload, error),
		purchase,
	};
}

/** Hand-wires the BYO/custom-hostname verification workflow only. */
export function createDomainConfigurationRuntime(
	db: Database,
	options: ConfigurationRuntimeOptions,
) {
	const core = createDomainCore(db, options);

	return { configuration: core.configuration };
}

/** Minimal composition used by attempt-five and onFailure terminalization. */
export function createDomainFailureRuntime(
	db: Database,
	logger: DomainFulfillmentLogger,
) {
	const infrastructure = createDomainInfrastructure(db, logger);

	return {
		finalizePurchase: (payload: DomainPurchasePayload, error: unknown) =>
			infrastructure.purchaseFailureFinalizer.execute(payload, error),
	};
}

/** Scheduled DB backstop; task-context dispatch does not require an API key. */
export function createDomainReconciliationRuntime(db: Database) {
	const domains = new DomainsRepository(db);

	return {
		reconciler: new DomainFulfillmentReconcilerService({
			findStalePurchaseCandidates: (input) =>
				domains.findStalePurchaseCandidates(input),
			now: () => new Date(),
			recoverPurchase: recoverDomainPurchaseTask,
		}),
	};
}

export function createDomainRenewalRuntime(db: Database) {
	return {
		renewalNotices: new DomainRenewalNoticesService(new DomainsRepository(db)),
	};
}

export function createDomainRegistrarSyncRuntime(
	db: Database,
	logger: DomainFulfillmentLogger = triggerDomainLogger,
) {
	return {
		registrarSync: new DomainRegistrarSyncService(
			new DomainsRepository(db),
			new NamecomProvider(),
			logger,
		),
	};
}

const triggerDomainLogger: DomainFulfillmentLogger = {
	error(message, details) {
		triggerLogger.error(message, { details });
	},
	warn(message, details) {
		triggerLogger.warn(message, { details });
	},
};

function createDomainCore(db: Database, options: ConfigurationRuntimeOptions) {
	const infrastructure = createDomainInfrastructure(db, options.logger);
	const activation = new DomainActivationStep({
		deleteCustomHostname: (id) =>
			infrastructure.customHostnames.deleteCustomHostname(id),
		deleteDomainPointer: (name) =>
			infrastructure.routing.deleteDomainPointer(name),
		findDomain: (domainId) => infrastructure.domains.getById(domainId),
		logger: options.logger,
		markDomainFailed: (domainId, summary) =>
			infrastructure.domains.markFailed(domainId, summary),
		markOrderFulfilled: (orderId) =>
			infrastructure.paymentOrders.markFulfilled(orderId),
		putDomainPointer: (name, pointer) =>
			infrastructure.routing.putDomainPointer(name, pointer),
		updateDomainIfStatus: (domainId, statuses, patch) =>
			infrastructure.domains.updateIfStatusOrNull(domainId, statuses, patch),
	});
	const verification = new CustomHostnameVerificationStep(
		infrastructure.customHostnames,
	);
	const configuration = new DomainConfigurationRunner({
		activation,
		cursors: {
			advanceCursor: (domainId, input) =>
				infrastructure.domains.advanceCursor(domainId, input),
			clearCursor: (domainId, nonce) =>
				infrastructure.domains.clearCursor(domainId, nonce),
			findDomain: (domainId) => infrastructure.domains.getById(domainId),
			initializeCursor: (domainId, input) =>
				infrastructure.domains.initializeCursor(domainId, input),
			readCursor: (domainId) => infrastructure.domains.readCursor(domainId),
		},
		now: options.now ?? (() => new Date()),
		terminalFailure: infrastructure.terminalFailure,
		verification,
		wait: options.wait,
	});

	return { ...infrastructure, activation, configuration, verification };
}

function createDomainInfrastructure(
	db: Database,
	logger: DomainFulfillmentLogger,
) {
	const domains = new DomainsRepository(db);
	const paymentOrders = new PaymentOrdersRepository(db);
	const customHostnames = new CustomHostnameService();
	const routing = new DomainRoutingService(domains);
	const state = new DomainFulfillmentStateService({
		findDomain: (domainId) => domains.getById(domainId),
		findOrder: (orderId) => paymentOrders.findById(orderId),
		logger,
		markOrderFulfilling: (orderId) => paymentOrders.markFulfilling(orderId),
		markOrderFulfilled: (orderId) => paymentOrders.markFulfilled(orderId),
		recordFinancialRaceNote: (orderId, note) =>
			paymentOrders.recordFinancialRaceNote(orderId, note),
		updateDomainIfStatus: (domainId, statuses, patch, transaction) =>
			domains.updateIfStatusOrNull(
				domainId,
				statuses,
				patch,
				transaction as DomainTransaction | undefined,
			),
		withOrderFulfillmentFence: (orderId, operation) =>
			paymentOrders.withOrderFulfillmentFence(orderId, (order, transaction) =>
				operation(order, transaction),
			),
	});
	const terminalFailure = new DomainTerminalFailureStep({
		deleteCustomHostname: (id) => customHostnames.deleteCustomHostname(id),
		deleteDomainPointer: (name) => routing.deleteDomainPointer(name),
		dispatchRefund: async (orderId, failureReason) => {
			await triggerOrderRefundTask({ failureReason, orderId });
		},
		findDomainForUpdate: (orderId, transaction) =>
			domains.findByPaymentOrderIdForUpdate(
				orderId,
				transaction as DomainTransaction,
			),
		logger,
		markDomainFailed: (domainId, summary) =>
			domains.markFailed(domainId, summary),
		markOrderFailed: (orderId, summary, transaction) =>
			paymentOrders.markFailed(
				orderId,
				summary,
				transaction as PaymentOrderTransaction,
			),
		markOrderFulfilled: (orderId) => paymentOrders.markFulfilled(orderId),
		reportError: (error, tags) => {
			Sentry.captureException(error, { tags });
		},
		updateDomainIfStatus: (domainId, statuses, patch, transaction) =>
			domains.updateIfStatusOrNull(
				domainId,
				statuses,
				patch,
				transaction as DomainTransaction,
			),
		withOrderFulfillmentFence: (orderId, operation) =>
			paymentOrders.withOrderFulfillmentFence(orderId, (order, transaction) =>
				operation(order, transaction),
			),
	});
	const purchaseFailureFinalizer = new DomainPurchaseFailureFinalizer({
		findDomain: (domainId) => domains.getById(domainId),
		terminalFailure,
	});

	return {
		customHostnames,
		domains,
		paymentOrders,
		purchaseFailureFinalizer,
		routing,
		state,
		terminalFailure,
	};
}
