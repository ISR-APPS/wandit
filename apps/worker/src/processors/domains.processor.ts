import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	DOMAIN_TLD_CATALOG,
	type DomainDns,
	domainDnsSchema,
	parseDomainName,
	registrantSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	DOMAINS_QUEUE,
	type DomainConfigureJobData,
	type DomainJobName,
	type DomainPurchaseJobData,
	type DomainRenewalsJobData,
	type DomainSyncJobData,
} from "@wandit/jobs";
import { Sentry } from "@wandit/observability/node";
import type { Job, Queue } from "bullmq";

import { apexRedirectTarget } from "../../../server/src/modules/domains/domain/domain-hosts";
import {
	DomainHttpError,
	DomainProviderError,
} from "../../../server/src/modules/domains/domain/errors/domain.errors";
import {
	DOMAIN_PROVIDER,
	type DomainDnsRecord,
	type DomainProvider,
} from "../../../server/src/modules/domains/domain/ports/domain-provider.port";
import { CustomHostnameService } from "../../../server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../../../server/src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import {
	type DomainRow,
	DomainsRepository,
} from "../../../server/src/modules/domains/infrastructure/persistence/domains.repository";
import { OrderRefundQueueService } from "../../../server/src/modules/orders/application/services/order-refund-queue.service";
import { PaymentOrdersRepository } from "../../../server/src/modules/orders/infrastructure/persistence/payment-orders.repository";

type DomainJobData =
	| DomainConfigureJobData
	| DomainPurchaseJobData
	| DomainRenewalsJobData
	| DomainSyncJobData;

type PurchaseDnsState = DomainDns & {
	customHostnameDnsConfigured?: boolean;
	purchaseDnsConfigured?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CONFIGURE_MAX_ATTEMPTS = 100;
const CONFIGURE_MAX_DELAY_MS = 15 * 60 * 1000;

class TerminalDomainJobError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TerminalDomainJobError";
	}
}

class OrderFulfillmentStoppedError extends Error {
	constructor(readonly reason: "financial_race" | "order_not_fulfillable") {
		super(
			reason === "financial_race"
				? "Payment order changed after registrar registration"
				: "Payment order is no longer eligible for registrar registration",
		);
		this.name = "OrderFulfillmentStoppedError";
	}
}

@Processor(DOMAINS_QUEUE)
export class DomainsProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(DomainsProcessor.name);

	constructor(
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
		@Inject(DOMAIN_PROVIDER)
		private readonly domainProvider: DomainProvider,
		@Inject(PaymentOrdersRepository)
		private readonly paymentOrdersRepository: PaymentOrdersRepository,
		@Inject(OrderRefundQueueService)
		private readonly orderRefundQueueService: OrderRefundQueueService,
		@Inject(CustomHostnameService)
		private readonly customHostnameService: CustomHostnameService,
		@Inject(DomainRoutingService)
		private readonly domainRoutingService: DomainRoutingService,
		@InjectQueue(DOMAINS_QUEUE)
		private readonly domainsQueue: Queue<DomainJobData, unknown, string>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await Promise.all([
			this.domainsQueue.upsertJobScheduler(
				"domain-renewals-daily",
				{ pattern: "0 2 * * *" },
				{
					data: {},
					name: "domain-renewals",
					opts: { removeOnComplete: 10, removeOnFail: 50 },
				},
			),
			this.domainsQueue.upsertJobScheduler(
				"domain-sync-weekly",
				{ pattern: "0 3 * * 0" },
				{
					data: {},
					name: "domain-sync",
					opts: { removeOnComplete: 10, removeOnFail: 50 },
				},
			),
		]);
		this.logger.log("Domain job schedulers registered");
	}

	async process(job: Job<DomainJobData, unknown, DomainJobName>) {
		try {
			switch (job.name) {
				case "domain-purchase":
					return await this.processDomainPurchase(
						job as Job<DomainPurchaseJobData, unknown, "domain-purchase">,
					);
				case "domain-configure":
					return await this.processDomainConfigure(
						job as Job<DomainConfigureJobData, unknown, "domain-configure">,
					);
				case "domain-renewals":
					return await this.processDomainRenewals();
				case "domain-sync":
					return await this.processDomainSync();
				default:
					return {
						processed: false,
						reason: `Unknown domains job ${job.name satisfies never}`,
					};
			}
		} catch (error) {
			// BullMQ records the failure but nothing reports it to Sentry.
			Sentry.captureException(error, {
				tags: { jobId: job.id, jobName: job.name },
			});
			throw error;
		}
	}

	private async processDomainPurchase(
		job: Job<DomainPurchaseJobData, unknown, "domain-purchase">,
	) {
		const data = job.data;
		const row = await this.domainsRepository.getById(data.domainId);

		if (!row) {
			return { processed: false, reason: "not_registering" };
		}

		let orderId: string | null;

		try {
			orderId = this.orderIdForPurchase(data, row);
		} catch (error) {
			// A job/row order mismatch is unrecoverable: fail the domain and route
			// any refund through the row's own order so money is never stranded.
			await this.terminalPurchaseFailure(row, error, row.paymentOrderId);

			return { processed: false, reason: "terminal_failure" };
		}

		const configureNonce = this.configureNonce(
			row,
			job.id ?? `purchase-${row.id}`,
		);

		if (row.status === "active") {
			await this.markOrderFulfilled(row);

			return { processed: false, reason: "already_active" };
		}

		if (row.status === "failed") {
			if (orderId) {
				await this.enqueueFailedOrderRefund(
					orderId,
					row.error ?? "Domain registration failed",
				);
				await this.bestEffortDeleteCustomHostname(row);
				await this.bestEffortDeleteDomainPointer(row);
			}

			return { processed: false, reason: "terminal_failure" };
		}

		if (row.status === "configuring") {
			try {
				await this.enqueueConfigure(row.id, 0, undefined, configureNonce);
			} catch (error) {
				if (!this.shouldTerminalPurchaseFailure(error, job)) {
					throw error;
				}

				await this.terminalPurchaseFailure(row, error, orderId);

				return { processed: false, reason: "terminal_failure" };
			}

			return { processed: false, reason: "configure_requeued" };
		}

		if (row.status !== "registering") {
			return { processed: false, reason: "not_registering" };
		}

		if (row.provider !== "namecom") {
			// Legacy rows (e.g. openprovider) cannot be fulfilled by this worker;
			// still route through the terminal path so an attached order refunds.
			await this.terminalPurchaseFailure(
				row,
				new TerminalDomainJobError("Unsupported registrar for this worker"),
				orderId,
			);

			return { processed: false, reason: "terminal_failure" };
		}

		try {
			if (orderId) {
				const orderState = await this.prepareOrderFulfillment(orderId);

				if (orderState === "missing") {
					this.logger.error(
						`MANUAL REVIEW REQUIRED: payment order ${orderId} not found for domain ${row.id}`,
					);
					await this.bestEffortDeleteCustomHostname(row);
					await this.domainsRepository.markFailed(
						row.id,
						"Payment order is missing for this domain purchase",
					);

					return { processed: false, reason: "terminal_failure" };
				}

				if (orderState === "repair_refund") {
					await this.terminalPurchaseFailure(
						row,
						new Error("Domain registration failed"),
						orderId,
					);

					return { processed: false, reason: "terminal_failure" };
				}

				if (orderState === "repair_domain") {
					await this.bestEffortDeleteCustomHostname(row);
					await this.domainsRepository.updateIfStatusOrNull(
						row.id,
						["registering", "configuring"],
						{
							error: "Domain registration failed",
							isPrimary: false,
							status: "failed",
						},
					);

					return { processed: false, reason: "terminal_failure" };
				}

				if (orderState === "stop") {
					return { processed: false, reason: "order_not_fulfillable" };
				}
			}

			await this.assertRegistrationAllowed(row);
			const registered = await this.ensureRegistered(row, orderId);
			const dnsConfigured = await this.ensurePurchasedDns(registered);
			const hostnameConfigured = await this.ensureCustomHostname(dnsConfigured);
			await this.updatePostRegistrationState(hostnameConfigured, {
				error: null,
				status: "configuring",
			});
			await this.enqueueConfigure(row.id, 0, undefined, configureNonce);

			return {
				processed: true,
				status: hostnameConfigured.status,
			};
		} catch (error) {
			if (error instanceof OrderFulfillmentStoppedError) {
				const current = await this.domainsRepository.getById(row.id);

				if (current?.status === "failed") {
					await this.bestEffortDeleteCustomHostname(current);
					await this.bestEffortDeleteDomainPointer(current);
				}

				return {
					processed: false,
					reason: error.reason,
				};
			}

			if (!this.shouldTerminalPurchaseFailure(error, job)) {
				throw error;
			}

			await this.terminalPurchaseFailure(row, error, orderId);

			return {
				processed: false,
				reason: "terminal_failure",
			};
		}
	}

	private async processDomainConfigure(
		job: Job<DomainConfigureJobData, unknown, "domain-configure">,
	) {
		const data = job.data;
		const row = await this.domainsRepository.getById(data.domainId);

		if (!row) {
			return { processed: false, reason: "not_configuring" };
		}

		if (row.status === "failed") {
			if (row.paymentOrderId) {
				await this.enqueueFailedOrderRefund(
					row.paymentOrderId,
					row.error ?? "Domain registration failed",
				);
				await this.bestEffortDeleteCustomHostname(row);
				await this.bestEffortDeleteDomainPointer(row);
			}

			return { processed: false, reason: "not_configuring" };
		}

		if (row.status === "active") {
			await this.markOrderFulfilled(row);

			return { processed: false, reason: "not_configuring" };
		}

		if (!row.cfCustomHostnameId) {
			if (row.source === "purchased") {
				await this.terminalPurchaseFailure(
					row,
					new Error("Missing Cloudflare custom hostname id"),
				);
			}

			return { processed: false, reason: "missing_cf_hostname" };
		}

		const attempt = data.attempt ?? 0;
		const nonce = this.configureNonce(row, data.nonce ?? job.id);
		let status: Awaited<
			ReturnType<CustomHostnameService["getCustomHostnameStatus"]>
		>;

		try {
			status = await this.customHostnameService.getCustomHostnameStatus(
				row.cfCustomHostnameId,
			);
		} catch (error) {
			return this.handleConfigureTransient(row, attempt, nonce, error, job);
		}

		if (status.status === "active") {
			if (!row.projectId) {
				if (row.paymentOrderId) {
					const active = await this.activateConfiguredDomain(row, {
						error: null,
						status: "active",
					});

					if (!active) {
						return { processed: false, reason: "state_changed" };
					}

					await this.markOrderFulfilled(active);

					return { processed: true, status: "active" };
				}

				await this.bestEffortDeleteCustomHostname(row);
				await this.domainsRepository.markFailed(
					row.id,
					"Domain is no longer attached to a project",
				);

				return { processed: false, reason: "detached" };
			}

			try {
				await this.domainRoutingService.putDomainPointer(row.name, {
					projectId: row.projectId,
					source: "domain",
				});
			} catch (error) {
				return this.handleConfigureTransient(row, attempt, nonce, error, job);
			}
			const active = await this.activateConfiguredDomain(row, {
				error: null,
				status: "active",
			});

			if (!active) {
				return { processed: false, reason: "state_changed" };
			}

			await this.markOrderFulfilled(active);

			return { processed: true, status: "active" };
		}

		if (attempt >= CONFIGURE_MAX_ATTEMPTS) {
			if (row.source === "purchased") {
				await this.terminalPurchaseFailure(
					row,
					new Error("Cloudflare SSL verification timed out"),
				);

				return { processed: false, reason: "timed_out" };
			}

			return { processed: false, reason: "external_still_pending" };
		}

		try {
			await this.enqueueConfigure(
				row.id,
				attempt + 1,
				this.configureDelay(attempt),
				nonce,
			);
		} catch (error) {
			return this.handleConfigureEnqueueFailure(row, job, error);
		}

		return { processed: false, reason: "pending" };
	}

	private async processDomainRenewals(now = new Date()) {
		/*
		 * Paid renewals are not wired yet (there is no `domain_renewal`
		 * payment-order kind), so this daily sweep only records expiry notices.
		 * Auto-renew is off by default and the API rejects enabling it.
		 */
		const candidates = await this.domainsRepository.findExpiringPurchased(now);
		let noticed = 0;

		for (const row of candidates) {
			const expiresAt = row.expiresAt;

			if (!expiresAt) {
				continue;
			}

			const daysUntilExpiry = Math.ceil(
				(expiresAt.getTime() - now.getTime()) / DAY_MS,
			);

			if (daysUntilExpiry > 30) {
				continue;
			}

			await this.domainsRepository.recordRenewalNotice(
				row.id,
				`Domain expires in ${Math.max(daysUntilExpiry, 0)} day(s); automatic renewal is not available yet`,
			);
			noticed += 1;
		}

		return { processed: true, noticed };
	}

	private async processDomainSync() {
		const rows = await this.domainsRepository.findPurchasedForSync();
		let failed = 0;
		let synced = 0;

		for (const row of rows) {
			try {
				const info = await this.domainProvider.getDomainInfo(row.name);

				if (!info) {
					await this.domainsRepository.updateById(row.id, {
						error: "Domain is no longer present in the registrar account",
						isPrimary: false,
						status: "transferred_out",
					});
					synced += 1;
					continue;
				}
				const status = this.syncedStatus(info.status);

				await this.domainsRepository.updateById(row.id, {
					...(info.expiresAt ? { expiresAt: info.expiresAt } : {}),
					...(status ? { status } : {}),
					transferLockExpiresAt: info.transferLockExpiresAt ?? null,
				});
				synced += 1;
			} catch (error) {
				// One bad row must not abort the weekly sweep for every other row.
				failed += 1;
				this.logger.warn(
					`Domain sync failed for ${row.id}`,
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		return { processed: true, failed, synced };
	}

	private async assertRegistrationAllowed(row: DomainRow): Promise<void> {
		if (row.providerDomainId) {
			return;
		}

		const existing = await this.domainProvider.getDomainInfo(row.name);

		if (existing) {
			// Likely our own earlier create whose receipt was lost mid-retry: the
			// availability gate would misread it as taken, while the replayed
			// idempotent create in ensureRegistered recovers the original result.
			return;
		}

		const [availability] = await this.domainProvider.checkAvailability([
			row.name,
		]);

		if (!availability?.available) {
			throw new TerminalDomainJobError("Domain is not available");
		}

		const parsed = parseDomainName(row.name);

		if (!parsed) {
			throw new TerminalDomainJobError(
				"Domain is not in the supported catalog",
			);
		}

		const ceiling = DOMAIN_TLD_CATALOG[parsed.tld].wholesaleCeilingUsd;

		// Fail closed: a missing quote is as blocking as an over-ceiling one.
		if (
			availability.premium ||
			typeof availability.wholesalePriceUsd !== "number" ||
			!Number.isFinite(availability.wholesalePriceUsd) ||
			availability.wholesalePriceUsd > ceiling
		) {
			throw new TerminalDomainJobError(
				"Domain price is premium, missing, or above the catalog safety ceiling",
			);
		}
	}

	private async ensureRegistered(
		row: DomainRow,
		orderId: string | null,
	): Promise<DomainRow> {
		if (row.providerDomainId) {
			return row;
		}

		const registrant = registrantSchema.safeParse(row.registrant);

		if (!registrant.success) {
			throw new TerminalDomainJobError("Registrant snapshot is invalid");
		}

		if (orderId) {
			await this.paymentOrdersRepository.withOrderFulfillmentFence(
				orderId,
				async (order) => {
					if (order.status !== "fulfilling") {
						this.logger.warn(
							`Skipping registrar purchase for payment order ${order.id} in ${order.status} state`,
						);
						throw new OrderFulfillmentStoppedError("order_not_fulfillable");
					}
				},
			);
		}

		/*
		 * The database fence must be released before calling the external
		 * registrar. A refund can still land in that unavoidable narrow window;
		 * every write after registration is therefore a status CAS, and a lost
		 * CAS records a loud manual-review note on the financially reversed order.
		 *
		 * Create is always replayed with the stable row-derived idempotency key
		 * when the row has no receipt: the registrar returns the original order
		 * after an ambiguous timeout. Merely finding the name in our registrar
		 * account is NOT proof it belongs to this customer's paid order, so no
		 * adopt-by-existence shortcut is taken here.
		 */
		const registered = await this.domainProvider.register(
			row.name,
			registrant.data,
			{
				idempotencyKey: `domain-purchase:${row.id}`,
				privacy: row.whoisPrivacy,
				years: 1,
			},
		);

		return this.updatePostRegistrationState(row, {
			expiresAt: registered.expiresAt,
			providerDomainId: registered.providerDomainId,
			providerOrderId: registered.providerOrderId ?? null,
			providerTotalPaidUsd:
				registered.totalPaidUsd === undefined
					? null
					: registered.totalPaidUsd.toFixed(2),
			transferLockExpiresAt: registered.transferLockExpiresAt ?? null,
		});
	}

	private async ensurePurchasedDns(row: DomainRow): Promise<DomainRow> {
		const dns = this.purchaseDnsState(row);

		if (dns.purchaseDnsConfigured) {
			return row;
		}

		const records: DomainDnsRecord[] = [
			{
				name: "www",
				type: "CNAME",
				value: env.DOMAINS_FALLBACK_ORIGIN,
			},
		];
		await this.domainProvider.setDnsRecords(row.name, records);
		await this.domainProvider.setUrlForwarding(
			row.name,
			apexRedirectTarget(row.name),
		);

		return this.updatePostRegistrationState(row, {
			dns: {
				...dns,
				purchaseDnsConfigured: true,
				records: [
					...(dns.records ?? []),
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: env.DOMAINS_FALLBACK_ORIGIN,
					},
				],
			},
		});
	}

	private async ensureCustomHostname(row: DomainRow): Promise<DomainRow> {
		let current = row;

		if (!current.cfCustomHostnameId) {
			const hostname = await this.customHostnameService.createCustomHostname(
				current.name,
			);
			const dns = this.purchaseDnsState(current);
			const validationRecords = hostname.requiredRecords.map((record) => ({
				name: record.name,
				purpose: "ownership_or_ssl_validation",
				type: record.type,
				value: record.value,
			}));

			/*
			 * Persist Cloudflare's id and TXT challenges before touching the
			 * registrar. If the later DNS call times out, the retry resumes this
			 * same hostname instead of creating a second one.
			 */
			try {
				current = await this.updatePostRegistrationState(current, {
					cfCustomHostnameId: hostname.id,
					dns: {
						...dns,
						records: this.mergeDnsRecords(dns.records ?? [], validationRecords),
					},
				});
			} catch (error) {
				try {
					await this.customHostnameService.deleteCustomHostname(hostname.id);
				} catch (cleanupError) {
					this.logger.warn(
						`Failed to delete unclaimed Cloudflare custom hostname ${hostname.id}`,
						cleanupError instanceof Error
							? cleanupError.message
							: String(cleanupError),
					);
				}

				throw error;
			}
		}

		let dns = this.purchaseDnsState(current);

		if (dns.customHostnameDnsConfigured) {
			return current;
		}

		let validationRecords = (dns.records ?? []).filter(
			(record) => record.purpose === "ownership_or_ssl_validation",
		);

		// Older rows may carry the Cloudflare id but not its validation records.
		if (validationRecords.length === 0 && current.cfCustomHostnameId) {
			const hostname = await this.customHostnameService.getCustomHostnameStatus(
				current.cfCustomHostnameId,
			);
			validationRecords = hostname.requiredRecords.map((record) => ({
				name: record.name,
				purpose: "ownership_or_ssl_validation",
				type: record.type,
				value: record.value,
			}));
			dns = {
				...dns,
				records: this.mergeDnsRecords(dns.records ?? [], validationRecords),
			};
		}

		// Cloudflare SSL validation can only pass once its challenge records
		// actually exist at the registrar.
		if (validationRecords.length > 0) {
			await this.domainProvider.setDnsRecords(
				current.name,
				validationRecords.map((record) => ({
					name: record.name,
					type: record.type,
					value: record.value,
				})),
			);
		}

		return this.updatePostRegistrationState(current, {
			dns: {
				...dns,
				customHostnameDnsConfigured: true,
			},
		});
	}

	private async updatePostRegistrationState(
		row: DomainRow,
		patch: Partial<DomainRow>,
	): Promise<DomainRow> {
		const updated = await this.domainsRepository.updateIfStatusOrNull(
			row.id,
			["registering"],
			patch,
		);

		if (updated) {
			return updated;
		}

		const current = await this.domainsRepository.getById(row.id);
		const orderId = row.paymentOrderId;

		if (orderId) {
			const order = await this.paymentOrdersRepository.findById(orderId);

			if (order?.status === "failed" || order?.status === "refunded") {
				const providerDomainId =
					typeof patch.providerDomainId === "string"
						? patch.providerDomainId
						: (row.providerDomainId ?? current?.providerDomainId);
				const note = `Manual review required: domain ${row.name} was purchased at the registrar${providerDomainId ? ` as ${providerDomainId}` : ""}, but payment order ${order.id} became ${order.status} before post-registration state could be committed.`;
				const recorded =
					await this.paymentOrdersRepository.recordFinancialRaceNote(
						order.id,
						note,
					);

				this.logger.error(
					`MANUAL REVIEW REQUIRED: registrar purchase outlived financial reversal for payment order ${order.id}`,
					JSON.stringify({
						domainId: row.id,
						domainName: row.name,
						orderId: order.id,
						orderStatus: order.status,
						providerDomainId: providerDomainId ?? null,
						recorded: recorded !== null,
					}),
				);

				throw new OrderFulfillmentStoppedError("financial_race");
			}
		}

		throw new Error(
			`Domain ${row.id} changed from registering during post-registration persistence`,
		);
	}

	private async terminalPurchaseFailure(
		row: DomainRow,
		error: unknown,
		orderId: string | null = row.paymentOrderId,
	): Promise<void> {
		// Terminal failures return normally to BullMQ (no throw), so the outer
		// process() capture never sees them — this is the only report point
		// for the original provider error.
		Sentry.captureException(error, {
			tags: { domainId: row.id, orderId: orderId ?? "none" },
		});
		if (orderId) {
			const failure = this.failureSummary(error);
			const current =
				await this.paymentOrdersRepository.withOrderFulfillmentFence(
					orderId,
					async (order, tx) => {
						const lockedDomain =
							await this.domainsRepository.findByPaymentOrderIdForUpdate(
								orderId,
								tx,
							);

						if (!lockedDomain || lockedDomain.id !== row.id) {
							throw new Error(
								`Payment order ${orderId} has no matching domain ${row.id}`,
							);
						}

						if (
							lockedDomain.status === "active" ||
							order.status === "fulfilled"
						) {
							return lockedDomain;
						}

						const needsRefund =
							order.status === "paid" ||
							order.status === "fulfilling" ||
							order.status === "failed";

						if (needsRefund) {
							/*
							 * Redis persistence happens before either terminal DB
							 * transition. The order/domain locks keep a fast worker
							 * from observing an intermediate committed state.
							 */
							await this.orderRefundQueueService.enqueue(orderId, failure);
						}

						const failedDomain =
							lockedDomain.status === "failed"
								? lockedDomain
								: await this.domainsRepository.updateIfStatusOrNull(
										lockedDomain.id,
										["registering", "configuring"],
										{
											error: failure,
											isPrimary: false,
											status: "failed",
										},
										tx,
									);

						if (
							needsRefund &&
							(order.status === "paid" || order.status === "fulfilling")
						) {
							await this.paymentOrdersRepository.markFailed(
								orderId,
								failure,
								tx,
							);
						}

						return failedDomain ?? lockedDomain;
					},
				);

			if (!current || current.status === "active") {
				if (current?.status === "active") {
					await this.markOrderFulfilled(current);
				}

				return;
			}

			if (current.status !== "failed") {
				return;
			}

			await this.bestEffortDeleteCustomHostname(current);
			await this.bestEffortDeleteDomainPointer(current);

			return;
		}

		/*
		 * No payment order is attached (legacy credits-era row), so there is no
		 * money to move — but note: when providerDomainId is set the domain was
		 * genuinely bought at the registrar, and a post-registration provisioning
		 * failure must never blindly refund a customer who now owns a domain we
		 * paid for. That policy lives in the fenced branch above.
		 */
		this.logger.warn(
			`Domain ${row.id} failed terminally with no payment order attached; nothing to refund`,
		);
		await this.bestEffortDeleteCustomHostname(row);
		await this.bestEffortDeleteDomainPointer(row);
		await this.domainsRepository.markFailed(row.id, this.failureSummary(error));
	}

	private async handleConfigureTransient(
		row: DomainRow,
		attempt: number,
		nonce: string,
		error: unknown,
		job: Job<DomainConfigureJobData, unknown, "domain-configure">,
	) {
		if (attempt >= CONFIGURE_MAX_ATTEMPTS) {
			if (row.source === "purchased") {
				await this.terminalPurchaseFailure(row, error);

				return { processed: false, reason: "timed_out" };
			}

			return { processed: false, reason: "external_still_pending" };
		}

		try {
			await this.enqueueConfigure(
				row.id,
				attempt + 1,
				this.configureDelay(attempt),
				nonce,
			);
		} catch (enqueueError) {
			return this.handleConfigureEnqueueFailure(row, job, enqueueError);
		}

		return { processed: false, reason: "transient_retry" };
	}

	private async handleConfigureEnqueueFailure(
		row: DomainRow,
		job: Job<DomainConfigureJobData, unknown, "domain-configure">,
		error: unknown,
	) {
		const attempts = job.opts.attempts ?? 1;

		if (job.attemptsMade + 1 < attempts || row.source !== "purchased") {
			throw error;
		}

		await this.terminalPurchaseFailure(row, error);

		return { processed: false, reason: "terminal_failure" };
	}

	private shouldTerminalPurchaseFailure(
		error: unknown,
		job: Job<DomainPurchaseJobData, unknown, "domain-purchase">,
	): boolean {
		// A registrar 4xx is final: retrying cannot fix it, and waiting the full
		// backoff schedule only pins a paid order in `fulfilling` for hours.
		if (
			error instanceof TerminalDomainJobError ||
			(error instanceof DomainProviderError && !error.retryable)
		) {
			return true;
		}

		const attempts = job.opts.attempts ?? 1;

		return job.attemptsMade + 1 >= attempts;
	}

	private orderIdForPurchase(
		data: DomainPurchaseJobData,
		row: DomainRow,
	): string | null {
		const paymentSource = data.paymentSource ?? "credits";

		if (paymentSource === "credits") {
			return null;
		}

		if (row.paymentOrderId !== data.orderId) {
			throw new Error(
				`Domain ${row.id} does not belong to payment order ${data.orderId}`,
			);
		}

		return data.orderId;
	}

	private async prepareOrderFulfillment(
		orderId: string,
	): Promise<"missing" | "ready" | "repair_domain" | "repair_refund" | "stop"> {
		const order = await this.paymentOrdersRepository.findById(orderId);

		if (!order) {
			// Data corruption: the job references an order that does not exist.
			// There is no money to refund and no fence to take — throwing here
			// would only retry forever with the domain stuck in `registering`.
			return "missing";
		}

		if (order.status === "fulfilling") {
			return "ready";
		}

		if (order.status === "failed") {
			return "repair_refund";
		}

		if (order.status === "refunded") {
			return "repair_domain";
		}

		if (order.status !== "paid") {
			return "stop";
		}

		const transitioned =
			await this.paymentOrdersRepository.markFulfilling(orderId);

		if (transitioned) {
			return "ready";
		}

		const current = await this.paymentOrdersRepository.findById(orderId);

		return current?.status === "fulfilling" ? "ready" : "stop";
	}

	private async enqueueFailedOrderRefund(
		orderId: string,
		failureReason: string,
	): Promise<void> {
		const order = await this.paymentOrdersRepository.findById(orderId);

		if (!order) {
			throw new Error(`Payment order ${orderId} not found`);
		}

		if (
			order.status === "paid" ||
			order.status === "fulfilling" ||
			order.status === "failed"
		) {
			await this.orderRefundQueueService.enqueue(orderId, failureReason);
		}
	}

	private async markOrderFulfilled(row: DomainRow): Promise<void> {
		if (!row.paymentOrderId) {
			return;
		}

		await this.paymentOrdersRepository.markFulfilled(row.paymentOrderId);
	}

	private async activateConfiguredDomain(
		row: DomainRow,
		patch: Partial<DomainRow>,
	): Promise<DomainRow | null> {
		const active = await this.domainsRepository.updateIfStatusOrNull(
			row.id,
			["configuring"],
			patch,
		);

		if (active) {
			return active;
		}

		const current = await this.domainsRepository.getById(row.id);

		if (current?.status === "active") {
			return current;
		}

		if (current?.status === "failed") {
			const hostnameDeleted =
				await this.bestEffortDeleteCustomHostname(current);
			await this.bestEffortDeleteDomainPointer(current);

			if (hostnameDeleted) {
				await this.domainsRepository.updateIfStatusOrNull(
					current.id,
					["failed"],
					{ cfCustomHostnameId: null },
				);
			}

			return null;
		}

		await this.bestEffortDeleteDomainPointer(row);

		return null;
	}

	private failureSummary(error: unknown): string {
		if (error instanceof TerminalDomainJobError) {
			return error.message;
		}

		if (error instanceof DomainHttpError) {
			const response = error.getResponse();

			if (
				typeof response === "object" &&
				response !== null &&
				"message" in response &&
				typeof response.message === "string"
			) {
				return response.message;
			}

			return error.message;
		}

		return "Domain registration failed";
	}

	private async bestEffortDeleteCustomHostname(
		row: DomainRow,
	): Promise<boolean> {
		if (!row.cfCustomHostnameId) {
			return false;
		}

		try {
			await this.customHostnameService.deleteCustomHostname(
				row.cfCustomHostnameId,
			);
			return true;
		} catch (error) {
			this.logger.warn(
				`Failed to delete Cloudflare custom hostname for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
			return false;
		}
	}

	private async bestEffortDeleteDomainPointer(row: DomainRow): Promise<void> {
		if (!row.projectId) {
			return;
		}

		try {
			await this.domainRoutingService.deleteDomainPointer(row.name);
		} catch (error) {
			this.logger.warn(
				`Failed to delete domain routing pointer for ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private purchaseDnsState(row: DomainRow): PurchaseDnsState {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
	}

	private mergeDnsRecords(
		existing: NonNullable<DomainDns["records"]>,
		incoming: NonNullable<DomainDns["records"]>,
	): NonNullable<DomainDns["records"]> {
		const records = new Map<
			string,
			NonNullable<DomainDns["records"]>[number]
		>();

		for (const record of [...existing, ...incoming]) {
			records.set(`${record.type}:${record.name}:${record.value}`, record);
		}

		return [...records.values()];
	}

	private configureDelay(attempt: number) {
		return Math.min(30_000 * 2 ** attempt, CONFIGURE_MAX_DELAY_MS);
	}

	private enqueueConfigure(
		domainId: string,
		attempt: number,
		delay?: number,
		nonce = String(Date.now()),
	) {
		return this.domainsQueue.add(
			"domain-configure",
			{ attempt, domainId, nonce },
			{
				attempts: 3,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				...(delay ? { delay } : {}),
				jobId: `domain-configure-${domainId}-${nonce.replaceAll(":", "-")}-${attempt}`,
				removeOnComplete: 1000,
				removeOnFail: 5000,
			},
		);
	}

	private configureNonce(row: DomainRow, fallback: unknown): string {
		return String(fallback ?? row.updatedAt.getTime());
	}

	private syncedStatus(status: string | undefined) {
		if (!status) {
			return null;
		}

		if (status.includes("expired")) {
			return "expired" as const;
		}

		if (status.includes("transferred")) {
			return "transferred_out" as const;
		}

		return null;
	}
}
