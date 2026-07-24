import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	type DomainDns,
	type DomainPriceSnapshot,
	domainDnsSchema,
	domainPriceSnapshotSchema,
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
import type { Job, Queue } from "bullmq";

import { InsufficientCreditsError } from "../../../server/src/modules/credits/domain/errors/insufficient-credits.error";
import { apexRedirectTarget } from "../../../server/src/modules/domains/domain/domain-hosts";
import { DomainHttpError } from "../../../server/src/modules/domains/domain/errors/domain.errors";
import {
	CREDITS_PORT,
	type CreditsPort,
} from "../../../server/src/modules/domains/domain/ports/credits.port";
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
		@Inject(CREDITS_PORT)
		private readonly creditsPort: CreditsPort,
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
		switch (job.name) {
			case "domain-purchase":
				return this.processDomainPurchase(
					job as Job<DomainPurchaseJobData, unknown, "domain-purchase">,
				);
			case "domain-configure":
				return this.processDomainConfigure(
					job as Job<DomainConfigureJobData, unknown, "domain-configure">,
				);
			case "domain-renewals":
				return this.processDomainRenewals();
			case "domain-sync":
				return this.processDomainSync();
			default:
				return {
					processed: false,
					reason: `Unknown domains job ${job.name satisfies never}`,
				};
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

		const orderId = this.orderIdForPurchase(data, row);
		const priceSnapshot = this.expectPriceSnapshot(row);
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

				await this.terminalPurchaseFailure(row, priceSnapshot, error, orderId);

				return { processed: false, reason: "terminal_failure" };
			}

			return { processed: false, reason: "configure_requeued" };
		}

		if (row.status !== "registering") {
			return { processed: false, reason: "not_registering" };
		}

		if (orderId) {
			const orderState = await this.prepareOrderFulfillment(orderId);

			if (orderState === "repair_refund") {
				await this.terminalPurchaseFailure(
					row,
					priceSnapshot,
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

		try {
			await this.assertRegistrationAllowed(row, priceSnapshot);
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

			await this.terminalPurchaseFailure(row, priceSnapshot, error, orderId);

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
					this.expectPriceSnapshot(row),
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
					this.expectPriceSnapshot(row),
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
		const candidates = await this.domainsRepository.findRenewalCandidates(now);
		let renewed = 0;
		let skipped = 0;

		for (const row of candidates) {
			const expiresAt = row.expiresAt;

			if (!expiresAt) {
				skipped += 1;
				continue;
			}

			const daysUntilExpiry = Math.ceil(
				(expiresAt.getTime() - now.getTime()) / DAY_MS,
			);

			if (daysUntilExpiry <= 5) {
				await this.domainsRepository.recordRenewalNotice(
					row.id,
					"Auto-renew stopped at T-5 because renewal credits were not available",
				);
				skipped += 1;
				continue;
			}

			const didRenew = await this.renewCandidate(row);
			renewed += didRenew ? 1 : 0;
			skipped += didRenew ? 0 : 1;
		}

		return { processed: true, renewed, skipped };
	}

	private async processDomainSync() {
		const rows = await this.domainsRepository.findPurchasedForSync();
		let synced = 0;

		for (const row of rows) {
			const info = await this.domainProvider.getDomainInfo(row.name);

			if (!info) {
				continue;
			}
			const status = this.syncedStatus(info.status);

			await this.domainsRepository.updateById(row.id, {
				...(info.expiresAt ? { expiresAt: info.expiresAt } : {}),
				...(status ? { status } : {}),
			});
			synced += 1;
		}

		return { processed: true, synced };
	}

	private async assertRegistrationAllowed(
		row: DomainRow,
		priceSnapshot: DomainPriceSnapshot,
	): Promise<void> {
		if (row.providerDomainId) {
			return;
		}

		const existing = await this.domainProvider.getDomainInfo(row.name);

		if (existing) {
			return;
		}

		const [availability] = await this.domainProvider.checkAvailability([
			row.name,
		]);

		if (!availability?.available) {
			throw new TerminalDomainJobError("Domain is not available");
		}

		if (
			availability.premium ||
			(typeof availability.wholesalePriceUsd === "number" &&
				availability.wholesalePriceUsd > priceSnapshot.wholesaleCeilingUsd)
		) {
			throw new TerminalDomainJobError(
				"Domain wholesale price exceeded catalog ceiling",
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

		const existing = await this.domainProvider.getDomainInfo(row.name);

		if (existing) {
			return this.updatePostRegistrationState(row, {
				expiresAt: existing.expiresAt,
				providerDomainId: existing.id,
			});
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
		 */
		const registered = await this.domainProvider.register(
			row.name,
			registrant.data,
			{
				privacy: row.whoisPrivacy,
				years: 1,
			},
		);

		return this.updatePostRegistrationState(row, {
			expiresAt: registered.expiresAt,
			providerDomainId: registered.providerDomainId,
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
		if (row.cfCustomHostnameId) {
			return row;
		}

		const hostname = await this.customHostnameService.createCustomHostname(
			row.name,
		);
		const dns = this.purchaseDnsState(row);

		try {
			return await this.updatePostRegistrationState(row, {
				cfCustomHostnameId: hostname.id,
				dns: {
					...dns,
					records: [
						...(dns.records ?? []),
						...hostname.requiredRecords.map((record) => ({
							name: record.name,
							purpose: "ownership_or_ssl_validation",
							type: record.type,
							value: record.value,
						})),
					],
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

	private async renewCandidate(row: DomainRow): Promise<boolean> {
		const priceSnapshot = this.expectPriceSnapshot(row);
		const periodEndYear = (row.expiresAt ?? new Date()).getUTCFullYear() + 1;
		const attemptUpdatedAtMs = row.updatedAt.getTime();
		const idempotencyKey = `domain-renew:${row.id}:${periodEndYear}:${attemptUpdatedAtMs}`;
		const providerInfo = await this.domainProvider.getDomainInfo(row.name);

		if (
			providerInfo?.expiresAt &&
			row.expiresAt &&
			providerInfo.expiresAt > row.expiresAt
		) {
			await this.domainsRepository.updateById(row.id, {
				error: null,
				expiresAt: providerInfo.expiresAt,
				status: "active",
			});

			return true;
		}

		try {
			await this.creditsPort.consume(row.userId, priceSnapshot.renewalCredits, {
				idempotencyKey,
				meta: {
					domainId: row.id,
					name: row.name,
					reason: "domain_auto_renewal",
				},
			});
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				await this.domainsRepository.recordRenewalNotice(
					row.id,
					"Auto-renew skipped because renewal credits were not available",
				);

				return false;
			}

			throw error;
		}

		try {
			const renewed = await this.domainProvider.renew(row.name, 1);
			await this.domainsRepository.updateById(row.id, {
				error: null,
				expiresAt:
					renewed.expiresAt ?? this.addYears(row.expiresAt ?? new Date(), 1),
				status: "active",
			});

			return true;
		} catch (error) {
			await this.domainsRepository.recordRenewalNotice(
				row.id,
				"Renewal failed; credits were refunded and the next retry will use a fresh charge attempt",
			);
			await this.creditsPort.grant(row.userId, priceSnapshot.renewalCredits, {
				bucket: "topup",
				idempotencyKey: `domain-renew-refund:${row.id}:${periodEndYear}:${attemptUpdatedAtMs}`,
				meta: {
					domainId: row.id,
					reason: "domain_renewal_failed",
				},
			});
			throw error;
		}
	}

	private async terminalPurchaseFailure(
		row: DomainRow,
		priceSnapshot: DomainPriceSnapshot,
		error: unknown,
		orderId: string | null = row.paymentOrderId,
	): Promise<void> {
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
		await this.grantPurchaseRefund(row, priceSnapshot);
		await this.bestEffortDeleteCustomHostname(row);
		await this.bestEffortDeleteDomainPointer(row);
		await this.domainsRepository.markFailed(row.id, this.failureSummary(error));
	}

	private async grantPurchaseRefund(
		row: DomainRow,
		priceSnapshot: DomainPriceSnapshot,
	): Promise<void> {
		const idempotencyKey = `domain-refund:${row.id}`;
		const amount = priceSnapshot.registrationCredits;
		const grant = () =>
			this.creditsPort.grant(row.userId, amount, {
				bucket: "topup",
				idempotencyKey,
				meta: {
					domainId: row.id,
					reason: "domain_registration_failed",
				},
			});

		try {
			await grant();
			return;
		} catch {
			// Retry once immediately for transient ledger/database failures.
		}

		try {
			await grant();
		} catch (error) {
			this.logger.error(
				"Domain purchase refund failed",
				JSON.stringify({
					amount,
					domainId: row.id,
					idempotencyKey,
					userId: row.userId,
				}),
			);
			throw error;
		}
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
				await this.terminalPurchaseFailure(
					row,
					this.expectPriceSnapshot(row),
					error,
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

		await this.terminalPurchaseFailure(
			row,
			this.expectPriceSnapshot(row),
			error,
		);

		return { processed: false, reason: "terminal_failure" };
	}

	private shouldTerminalPurchaseFailure(
		error: unknown,
		job: Job<DomainPurchaseJobData, unknown, "domain-purchase">,
	): boolean {
		if (error instanceof TerminalDomainJobError) {
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
	): Promise<"ready" | "repair_domain" | "repair_refund" | "stop"> {
		const order = await this.paymentOrdersRepository.findById(orderId);

		if (!order) {
			throw new Error(`Payment order ${orderId} not found`);
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

	private expectPriceSnapshot(row: DomainRow): DomainPriceSnapshot {
		const parsed = domainPriceSnapshotSchema.safeParse(row.priceSnapshot);

		if (!parsed.success) {
			throw new Error(`Domain ${row.id} is missing price snapshot`);
		}

		return parsed.data;
	}

	private purchaseDnsState(row: DomainRow): PurchaseDnsState {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
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

	private addYears(date: Date, years: number): Date {
		const copy = new Date(date);
		copy.setUTCFullYear(copy.getUTCFullYear() + years);

		return copy;
	}
}
