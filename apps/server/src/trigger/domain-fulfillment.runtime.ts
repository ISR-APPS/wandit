import { logger as triggerLogger } from "@trigger.dev/sdk";
import type { DomainSource, DomainStatus } from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";

import { ApexZoneStep } from "../modules/domains/application/fulfillment/apex-zone.step";
import { CustomHostnameConfigurationStep } from "../modules/domains/application/fulfillment/custom-hostname-configuration.step";
import { CustomHostnameVerificationStep } from "../modules/domains/application/fulfillment/custom-hostname-verification.step";
import { DomainActivationStep } from "../modules/domains/application/fulfillment/domain-activation.step";
import { DomainConfigurationRunner } from "../modules/domains/application/fulfillment/domain-configuration-runner";
import type {
	DomainApexDnsPatch,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
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
import { ExternalDomainDelegationRemindersService } from "../modules/domains/application/maintenance/external-domain-delegation-reminders.service";
import { CustomHostnameService } from "../modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { CustomerZoneService } from "../modules/domains/infrastructure/cloudflare/customer-zone.service";
import { DomainRoutingService } from "../modules/domains/infrastructure/cloudflare/domain-routing.service";
import { NamecomProvider } from "../modules/domains/infrastructure/namecom/namecom.provider";
import {
	DomainsRepository,
	type DomainTransaction,
} from "../modules/domains/infrastructure/persistence/domains.repository";
import {
	recoverDomainConfigurationTask,
	recoverDomainPurchaseTask,
} from "../modules/domains/infrastructure/trigger/trigger-domain-task-dispatcher.service";
import { EmailService } from "../modules/email/application/services/email.service";
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

type ApexZoneRuntimeOptions = {
	apexZoneEnabled: boolean;
	fallbackOrigin: string;
	logger: DomainFulfillmentLogger;
};

type PurchaseRuntimeOptions = ConfigurationRuntimeOptions &
	ApexZoneRuntimeOptions;

type ApexZoneRegistrar = {
	setNameservers(name: string, nameservers: string[]): Promise<void>;
};

/**
 * External rows delegate at their own registrar with the exposed nameservers;
 * the step never calls this for them, so a call is a wiring bug, not a retry.
 */
const manualNameserverRegistrar: ApexZoneRegistrar = {
	async setNameservers() {
		throw new Error("External domains delegate nameservers manually");
	},
};

/**
 * Apex dns writes may land while the row is `registering` (purchase pass),
 * `configuring` (verification probes, backfill) or `active` (backfill), and
 * must never reach a terminal row whose hostnames were already released.
 */
const APEX_DNS_LIVE_STATUSES: DomainStatus[] = [
	"registering",
	"configuring",
	"active",
];

/** Hand-wires the complete purchased-domain workflow for one task-local DB. */
export function createDomainPurchaseRuntime(
	db: Database,
	options: PurchaseRuntimeOptions,
) {
	const infrastructure = createDomainInfrastructure(db, options.logger);
	const registrar = new NamecomProvider();
	const apexZone = createApexZoneStep(infrastructure, registrar, options, [
		"purchased",
	]);
	const core = createDomainCore(infrastructure, options, apexZone);
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
		apexZone,
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

/**
 * Apex-only composition for `scripts/backfill-apex-zones.ts`. It runs the
 * same best-effort ApexZoneStep, with the same merge-based apex dns
 * persistence, as the purchase runtime.
 */
export function createDomainApexBackfillRuntime(
	db: Database,
	options: ApexZoneRuntimeOptions,
) {
	const infrastructure = createDomainInfrastructure(db, options.logger);
	const state = createApexDnsState(infrastructure.domains);

	return {
		apexZone: createApexZoneStep(
			infrastructure,
			new NamecomProvider(),
			options,
			["purchased"],
			state,
		),
		domains: infrastructure.domains,
		state,
	};
}

/**
 * Hand-wires the BYO/custom-hostname verification workflow plus the
 * best-effort apex zone pass for EXTERNAL rows (zone in our account, DNS
 * import, apex hostname, nameservers exposed to the user). `domain-configure`
 * asserts no registrar credentials, so purchased rows are never handled here:
 * they are only retried by the purchase runtime and the backfill.
 */
export function createDomainConfigurationRuntime(
	db: Database,
	options: ConfigurationRuntimeOptions & ApexZoneRuntimeOptions,
) {
	const infrastructure = createDomainInfrastructure(db, options.logger);
	const apexZone = createApexZoneStep(
		infrastructure,
		manualNameserverRegistrar,
		options,
		["external"],
	);
	const core = createDomainCore(infrastructure, options, apexZone);

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
			findStaleConfigurationCandidates: (input) =>
				domains.findStaleConfigurationCandidates(input),
			findStalePurchaseCandidates: (input) =>
				domains.findStalePurchaseCandidates(input),
			now: () => new Date(),
			recoverConfiguration: recoverDomainConfigurationTask,
			recoverPurchase: recoverDomainPurchaseTask,
		}),
	};
}

export function createDomainRenewalRuntime(db: Database) {
	return {
		renewalNotices: new DomainRenewalNoticesService(new DomainsRepository(db)),
	};
}

export function createExternalDomainDelegationRemindersRuntime(db: Database) {
	const domains = new DomainsRepository(db);

	return {
		delegationReminders: new ExternalDomainDelegationRemindersService(
			domains,
			new EmailService(),
			new CustomerZoneService(),
			{
				dashboardOrigin: env.CORS_ORIGIN,
				logger: triggerDomainLogger,
			},
		),
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

/**
 * ApexZoneStep state: a jsonb merge of the apex-owned keys fenced on the live
 * statuses. A lost fence throws so the step records nothing for a row that was
 * terminalized underneath it (and releases a hostname it just made).
 */
function createApexDnsState(domains: DomainsRepository) {
	return {
		async persistApexDns(
			row: DomainFulfillmentRow,
			patch: DomainApexDnsPatch,
		): Promise<DomainFulfillmentRow> {
			const updated = await domains.mergeDnsIfStatus(
				row.id,
				APEX_DNS_LIVE_STATUSES,
				patch,
			);

			if (!updated) {
				throw new Error(
					`Domain ${row.id} left status ${row.status} during apex configuration`,
				);
			}

			return updated;
		},
	};
}

function createApexZoneStep(
	infrastructure: ReturnType<typeof createDomainInfrastructure>,
	registrar: ApexZoneRegistrar,
	options: ApexZoneRuntimeOptions,
	sources: readonly DomainSource[],
	state = createApexDnsState(infrastructure.domains),
) {
	return new ApexZoneStep(
		infrastructure.customerZones,
		infrastructure.customHostnames,
		registrar,
		state,
		options.logger,
		{
			enabled: options.apexZoneEnabled,
			fallbackOrigin: options.fallbackOrigin,
			sources,
		},
	);
}

function createDomainCore(
	infrastructure: ReturnType<typeof createDomainInfrastructure>,
	options: ConfigurationRuntimeOptions,
	apexZone?: ApexZoneStep,
) {
	const activation = new DomainActivationStep({
		activateExternalDomain: (domainId, statuses) =>
			infrastructure.domains.activateAndClearExternalVerification(
				domainId,
				statuses,
			),
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
		apexZone,
		cursors: {
			advanceCursor: (domainId, input) =>
				infrastructure.domains.advanceCursor(domainId, input),
			clearCursor: (domainId, nonce) =>
				infrastructure.domains.clearCursor(domainId, nonce),
			findDomain: (domainId) => infrastructure.domains.getById(domainId),
			initializeCursor: (domainId, input) =>
				infrastructure.domains.initializeCursor(domainId, input),
			markExternalVerificationStalled: (domainId, input) =>
				infrastructure.domains.markExternalVerificationStalled(domainId, input),
			mergeDnsIfStatus: (domainId, statuses, patch) =>
				infrastructure.domains.mergeDnsIfStatus(domainId, statuses, patch),
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
	const customerZones = new CustomerZoneService();
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
		deleteZone: (id) => customerZones.deleteZone(id),
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
		customerZones,
		customHostnames,
		domains,
		paymentOrders,
		purchaseFailureFinalizer,
		routing,
		state,
		terminalFailure,
	};
}
