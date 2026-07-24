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
	type DomainSyncJobData,
} from "@wandit/jobs";
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

type DomainJobData =
	| DomainConfigureJobData
	| DomainPurchaseJobData
	| DomainSyncJobData;

type PurchaseDnsState = DomainDns & {
	customHostnameDnsConfigured?: boolean;
	purchaseDnsConfigured?: boolean;
};

const CONFIGURE_MAX_ATTEMPTS = 100;
const CONFIGURE_MAX_DELAY_MS = 15 * 60 * 1000;

class TerminalDomainJobError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TerminalDomainJobError";
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
		await this.domainsQueue.upsertJobScheduler(
			"domain-sync-weekly",
			{ pattern: "0 3 * * 0" },
			{
				data: {},
				name: "domain-sync",
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("Domain sync scheduler registered");
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

		if (row?.status !== "registering") {
			return { processed: false, reason: "not_registering" };
		}

		if (row.provider !== "namecom") {
			await this.domainsRepository.markFailed(
				row.id,
				"Unsupported registrar for this worker",
			);

			return { processed: false, reason: "unsupported_provider" };
		}

		try {
			await this.assertRegistrationAllowed(row);
			const registered = await this.ensureRegistered(row);
			const dnsConfigured = await this.ensurePurchasedDns(registered);
			const hostnameConfigured = await this.ensureCustomHostname(dnsConfigured);
			await this.domainsRepository.updateIfStatus(row.id, ["registering"], {
				error: null,
				status: "configuring",
			});
			await this.enqueueConfigure(
				row.id,
				0,
				undefined,
				this.configureNonce(row, job.id),
			);

			return {
				processed: true,
				status: hostnameConfigured.status,
			};
		} catch (error) {
			if (!this.shouldTerminalPurchaseFailure(error, job)) {
				throw error;
			}

			await this.terminalPurchaseFailure(row, error);

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

		if (!row || row.status === "active" || row.status === "failed") {
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
			return this.handleConfigureTransient(row, attempt, nonce, error);
		}

		if (status.status === "active") {
			if (!row.projectId) {
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
				return this.handleConfigureTransient(row, attempt, nonce, error);
			}
			await this.domainsRepository.updateById(row.id, {
				error: null,
				status: "active",
			});

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

		await this.enqueueConfigure(
			row.id,
			attempt + 1,
			this.configureDelay(attempt),
			nonce,
		);

		return { processed: false, reason: "pending" };
	}

	private async processDomainSync() {
		const rows = await this.domainsRepository.findPurchasedForSync();
		let synced = 0;

		for (const row of rows) {
			const info = await this.domainProvider.getDomainInfo(row.name);

			if (!info) {
				await this.domainsRepository.updateById(row.id, {
					error: "Domain is no longer present in the Name.com account",
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
		}

		return { processed: true, synced };
	}

	private async assertRegistrationAllowed(row: DomainRow): Promise<void> {
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

		const parsed = parseDomainName(row.name);

		if (!parsed) {
			throw new TerminalDomainJobError(
				"Domain is not in the supported catalog",
			);
		}

		const ceiling = DOMAIN_TLD_CATALOG[parsed.tld].wholesaleCeilingUsd;

		if (
			availability.premium ||
			typeof availability.wholesalePriceUsd !== "number" ||
			availability.wholesalePriceUsd > ceiling
		) {
			throw new TerminalDomainJobError(
				"Domain price is premium, missing, or above the catalog safety ceiling",
			);
		}
	}

	private async ensureRegistered(row: DomainRow): Promise<DomainRow> {
		if (row.providerDomainId) {
			return row;
		}

		const registrant = registrantSchema.safeParse(row.registrant);

		if (!registrant.success) {
			throw new TerminalDomainJobError("Registrant snapshot is invalid");
		}

		/*
		 * Always replay create with our stable key when the row has no receipt.
		 * This recovers the original Name.com order after an ambiguous timeout.
		 * Merely finding the name in our registrar account is not enough proof that
		 * it belongs to this customer's paid order.
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

		return this.domainsRepository.updateById(row.id, {
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

		return this.domainsRepository.setDns(row.id, {
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
			 * Persist Cloudflare's id and TXT challenges before touching Name.com.
			 * If the DNS call times out, the retry resumes this same hostname instead
			 * of creating a second one.
			 */
			current = await this.domainsRepository.updateById(current.id, {
				cfCustomHostnameId: hostname.id,
				dns: {
					...dns,
					records: this.mergeDnsRecords(dns.records ?? [], validationRecords),
				},
			});
		}

		let dns = this.purchaseDnsState(current);

		if (dns.customHostnameDnsConfigured) {
			return current;
		}

		let validationRecords = (dns.records ?? []).filter(
			(record) => record.purpose === "ownership_or_ssl_validation",
		);

		// Older rows may have the Cloudflare id but not its validation records.
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

		return this.domainsRepository.setDns(current.id, {
			...dns,
			customHostnameDnsConfigured: true,
		});
	}

	private async terminalPurchaseFailure(
		row: DomainRow,
		error: unknown,
	): Promise<void> {
		const latest = (await this.domainsRepository.getById(row.id)) ?? row;

		if (latest.providerDomainId) {
			/*
			 * Name.com already owns the domain now. A hosting/SSL failure must be
			 * repaired; automatically refunding the full payment would give away a
			 * paid domain and would not undo the registrar charge.
			 */
			this.logger.error(
				"Name.com registration succeeded but domain provisioning failed; manual repair required",
				JSON.stringify({
					domainId: latest.id,
					name: latest.name,
					providerOrderId: latest.providerOrderId,
				}),
			);
		} else {
			await this.bestEffortDeleteCustomHostname(latest);
			/*
			 * PAYMENT INTEGRATION — intentionally a log for now.
			 *
			 * DomainsModule will request an idempotent refund from PaymentsModule
			 * using the domain-order reference. There is no speculative Stripe call.
			 */
			this.logger.warn(
				"Domain registration failed before registrar purchase; payment refund hook is not connected",
				JSON.stringify({ domainId: latest.id, name: latest.name }),
			);
		}

		await this.domainsRepository.markFailed(
			latest.id,
			this.failureSummary(error),
		);
	}

	private async handleConfigureTransient(
		row: DomainRow,
		attempt: number,
		nonce: string,
		error: unknown,
	) {
		if (attempt >= CONFIGURE_MAX_ATTEMPTS) {
			if (row.source === "purchased") {
				await this.terminalPurchaseFailure(row, error);

				return { processed: false, reason: "timed_out" };
			}

			return { processed: false, reason: "external_still_pending" };
		}

		await this.enqueueConfigure(
			row.id,
			attempt + 1,
			this.configureDelay(attempt),
			nonce,
		);

		return { processed: false, reason: "transient_retry" };
	}

	private shouldTerminalPurchaseFailure(
		error: unknown,
		job: Job<DomainPurchaseJobData, unknown, "domain-purchase">,
	): boolean {
		if (
			error instanceof TerminalDomainJobError ||
			(error instanceof DomainProviderError && !error.retryable)
		) {
			return true;
		}

		const attempts = job.opts.attempts ?? 1;

		return job.attemptsMade + 1 >= attempts;
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

	private async bestEffortDeleteCustomHostname(row: DomainRow): Promise<void> {
		if (!row.cfCustomHostnameId) {
			return;
		}

		try {
			await this.customHostnameService.deleteCustomHostname(
				row.cfCustomHostnameId,
			);
		} catch (error) {
			this.logger.warn(
				`Failed to delete Cloudflare custom hostname for domain ${row.id}`,
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
				jobId: `domain-configure:${domainId}:${nonce}:${attempt}`,
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
