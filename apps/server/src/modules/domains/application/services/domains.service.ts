import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, type Logger, Optional } from "@nestjs/common";
import {
	type AttachExternalDomainBody,
	type AttachExternalDomainResponse,
	type DetachDomainResponse,
	DOMAIN_TLD_CATALOG,
	type DomainAvailabilityStatus,
	type DomainDns,
	type DomainTld,
	domainDnsSchema,
	domainTlds,
	isReservedDomainName,
	isValidDomainLabel,
	type ListDomainsResponse,
	type PurchaseDomainBody,
	type PurchaseDomainResponse,
	parseDomainName,
	parseExternalDomainName,
	type RenewDomainResponse,
	type RequiredDomainRecord,
	type SearchDomainsResponse,
	type SetPrimaryDomainResponse,
	type TransferUnlockDomainResponse,
	type UpdateDomainAutoRenewBody,
	type UpdateDomainAutoRenewResponse,
	type VerifyDomainResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { DOMAINS_QUEUE, type DomainJobName } from "@wandit/jobs";
import type { JobsOptions, Queue } from "bullmq";

import {
	DomainBlockedError,
	DomainNotAvailableError,
	DomainPaymentsNotConfiguredError,
	InvalidDomainStateError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import {
	DOMAIN_PROVIDER,
	type DomainAvailability,
	type DomainProvider,
} from "../../domain/ports/domain-provider.port";
import { CustomHostnameService } from "../../infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import { mapDomain } from "../../infrastructure/mappers/domain.mapper";
import {
	type DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";

export const DOMAINS_LOGGER = Symbol("DOMAINS_LOGGER");

type DomainLogger = Pick<Logger, "error" | "log" | "warn">;

type DomainJobData =
	| { domainId: string }
	| { attempt?: number; domainId: string; nonce?: string }
	| Record<string, never>;

@Injectable()
export class DomainsService {
	constructor(
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
		@Inject(DOMAIN_PROVIDER)
		private readonly domainProvider: DomainProvider,
		@Inject(CustomHostnameService)
		private readonly customHostnameService: CustomHostnameService,
		@Inject(DomainRoutingService)
		private readonly domainRoutingService: DomainRoutingService,
		@Inject(DOMAINS_LOGGER)
		private readonly logger: DomainLogger,
		@Optional()
		@InjectQueue(DOMAINS_QUEUE)
		private readonly domainsQueue?: Queue,
	) {}

	async search(_userId: string, q: string): Promise<SearchDomainsResponse> {
		const candidates = this.searchCandidates(q);
		const availability = await this.domainProvider.checkAvailability(
			candidates.map((candidate) => candidate.name),
		);
		const availabilityByName = new Map(
			availability.map((item) => [item.name, item]),
		);

		return {
			results: candidates.map((candidate) => {
				const catalog = DOMAIN_TLD_CATALOG[candidate.tld];
				const result = availabilityByName.get(candidate.name);
				const availability = this.publicAvailability(
					candidate.name,
					catalog,
					result,
				);

				return {
					availability,
					name: candidate.name,
					// Only expose Name.com's current USD registration quote when
					// the same result is safe to purchase. Every other state is null.
					registrationPriceUsd:
						availability === "available"
							? (result?.wholesalePriceUsd ?? null)
							: null,
					tld: candidate.tld,
				};
			}),
		};
	}

	async list(projectId: string, userId: string): Promise<ListDomainsResponse> {
		const rows = await this.domainsRepository.listByProject(projectId, userId);

		return { domains: rows.map(mapDomain) };
	}

	async purchase(
		userId: string,
		projectId: string,
		body: PurchaseDomainBody,
	): Promise<PurchaseDomainResponse> {
		const parsed = this.parseSafeDomainName(body.name);

		await this.domainsRepository.assertProjectOwned(userId, projectId);

		const [availability] = await this.domainProvider.checkAvailability([
			parsed.name,
		]);
		this.assertDomainAvailable(parsed.name, availability);

		this.logger.log(
			`Domain checkout stopped before payment for ${parsed.name} (user ${userId}, project ${projectId})`,
		);

		/*
		 * PAYMENT INTEGRATION — intentionally empty for now.
		 *
		 * 1. DomainsModule creates a durable pending domain order containing the
		 *    name, registrant, quote, user, and project.
		 * 2. Ask PaymentsModule for checkout using only that order reference and
		 *    the amount/currency, then return its checkout URL.
		 * 3. PaymentsModule verifies Stripe's webhook and emits one idempotent
		 *    success for the order. DomainsModule then creates the domain row and
		 *    enqueues `domain-purchase`. Only that worker may charge Name.com.
		 *
		 * Important: do not move registration back into this HTTP request. A user
		 * closing their browser must not lose an already-paid purchase.
		 */
		throw new DomainPaymentsNotConfiguredError();
	}

	async attachExternal(
		userId: string,
		projectId: string,
		body: AttachExternalDomainBody,
	): Promise<AttachExternalDomainResponse> {
		const parsed = this.parseSafeExternalDomainName(body.name);

		await this.domainsRepository.assertProjectOwned(userId, projectId);

		const row = await this.domainsRepository.createExternalReplacingTerminal({
			name: parsed.name,
			projectId,
			tld: parsed.tld,
			userId,
		});
		let customHostnameId: string | null = null;

		try {
			const hostname = await this.customHostnameService.createCustomHostname(
				parsed.name,
			);
			customHostnameId = hostname.id;
			const requiredRecords = this.requiredRecords(
				parsed.name,
				hostname.requiredRecords,
			);
			const dns = this.dnsWithRequiredRecords(requiredRecords);
			const updated = await this.domainsRepository.updateById(row.id, {
				cfCustomHostnameId: hostname.id,
				dns,
			});

			const nonce = String(updated.updatedAt.getTime());

			await this.enqueueDomainJob(
				"domain-configure",
				{ attempt: 0, domainId: row.id, nonce },
				`domain-configure:${row.id}:${nonce}:0`,
			);

			return {
				domain: mapDomain(updated),
				requiredRecords,
			};
		} catch (error) {
			if (customHostnameId) {
				await this.bestEffortDeleteCustomHostname(customHostnameId, row.id);
			}
			await this.domainsRepository.deleteById(row.id);
			throw error;
		}
	}

	async verify(id: string, userId: string): Promise<VerifyDomainResponse> {
		const row = await this.domainsRepository.getByIdForUser(id, userId);

		if (!row.cfCustomHostnameId) {
			throw new InvalidDomainStateError(
				"Domain does not have a Cloudflare hostname yet",
			);
		}

		const status = await this.customHostnameService.getCustomHostnameStatus(
			row.cfCustomHostnameId,
		);
		const requiredRecords = this.requiredRecords(
			row.name,
			status.requiredRecords,
			row,
		);

		if (this.isHostnameActive(status.status)) {
			const active = await this.activateDomain(row);

			return { domain: mapDomain(active), requiredRecords };
		}

		await this.enqueueDomainJob(
			"domain-configure",
			{ attempt: 0, domainId: row.id },
			`domain-configure:${row.id}:manual:${Date.now()}`,
		);

		return {
			domain: mapDomain(row),
			requiredRecords,
		};
	}

	async renew(id: string, userId: string): Promise<RenewDomainResponse> {
		const row = await this.domainsRepository.getByIdForUser(id, userId);

		this.assertRenewable(row);

		this.logger.log(
			`Domain renewal stopped before payment for ${row.name} (user ${userId})`,
		);

		/*
		 * PAYMENT INTEGRATION — intentionally empty for now.
		 *
		 * DomainsModule first creates a durable renewal order. A verified payment
		 * event for that order may then enqueue a dedicated renewal-fulfillment job.
		 * Name.com's renew endpoint spends registrar balance, so it must never run
		 * merely because this button was clicked.
		 */
		throw new DomainPaymentsNotConfiguredError();
	}

	async setAutoRenew(
		id: string,
		userId: string,
		body: UpdateDomainAutoRenewBody,
	): Promise<UpdateDomainAutoRenewResponse> {
		const row = await this.domainsRepository.getByIdForUser(id, userId);

		if (body.autoRenew) {
			this.logger.log(
				`Auto-renew enable stopped before payment setup for ${row.name} (user ${userId})`,
			);

			/*
			 * PAYMENT INTEGRATION — intentionally empty for now.
			 *
			 * Enabling auto-renew needs a saved Stripe payment method, customer
			 * consent, and webhook-driven fulfillment. Disabling it is always safe.
			 */
			throw new DomainPaymentsNotConfiguredError();
		}

		const updated = await this.domainsRepository.updateById(id, {
			autoRenew: false,
		});

		return { domain: mapDomain(updated) };
	}

	async setPrimary(
		id: string,
		userId: string,
	): Promise<SetPrimaryDomainResponse> {
		const updated = await this.domainsRepository.setPrimary(id, userId);

		return { domain: mapDomain(updated) };
	}

	async detach(id: string, userId: string): Promise<DetachDomainResponse> {
		const row = await this.domainsRepository.getByIdForUser(id, userId);

		if (row.status === "active") {
			await this.domainRoutingService.deleteDomainPointer(row.name);
		}

		if (row.cfCustomHostnameId) {
			await this.bestEffortDeleteCustomHostname(row.cfCustomHostnameId, row.id);
		}

		const updated = await this.domainsRepository.detach(id, userId);

		return { domain: mapDomain(updated) };
	}

	async transferUnlock(
		id: string,
		userId: string,
	): Promise<TransferUnlockDomainResponse> {
		const row = await this.domainsRepository.getByIdForUser(id, userId);

		if (
			row.source !== "purchased" ||
			row.provider !== "namecom" ||
			row.status === "failed"
		) {
			throw new InvalidDomainStateError(
				"Only Name.com-purchased domains can be unlocked for transfer",
			);
		}

		await this.domainProvider.setTransferLock(row.name, false);
		const authCode = await this.domainProvider.getAuthCode(row.name);
		const providerInfo = await this.domainProvider.getDomainInfo(row.name);
		const lockedUntil =
			providerInfo?.transferLockExpiresAt ??
			row.transferLockExpiresAt ??
			this.icannLockedUntil(row.createdAt);

		return {
			authCode,
			...(lockedUntil ? { lockedUntil: lockedUntil.toISOString() } : {}),
		};
	}

	async activateDomain(row: DomainRow): Promise<DomainRow> {
		if (!row.projectId) {
			throw new InvalidDomainStateError(
				"Domain must be attached to a project before activation",
			);
		}

		await this.domainRoutingService.putDomainPointer(row.name, {
			projectId: row.projectId,
			source: "domain",
		});

		return this.domainsRepository.updateById(row.id, {
			error: null,
			status: "active",
		});
	}

	private searchCandidates(q: string): Array<{ name: string; tld: DomainTld }> {
		const normalized = q
			.trim()
			.toLowerCase()
			.replace(/^\.+|\.+$/g, "");

		if (normalized.includes(".")) {
			const parsed = this.parseSafeDomainName(normalized);

			return [{ name: parsed.name, tld: parsed.tld }];
		}

		if (!isValidDomainLabel(normalized)) {
			throw new DomainBlockedError(
				"Search must be a valid ASCII domain label or supported domain",
			);
		}

		return domainTlds.map((tld) => {
			const name = `${normalized}.${tld}`;

			if (isReservedDomainName(name)) {
				throw new DomainBlockedError("Reserved Wandit domains are blocked");
			}

			return { name, tld };
		});
	}

	private parseSafeDomainName(name: string) {
		const parsed = parseDomainName(name);

		if (!parsed) {
			throw new DomainBlockedError(
				"Domain name must be an unreserved, supported sld.tld name",
			);
		}

		return parsed;
	}

	private parseSafeExternalDomainName(name: string) {
		const parsed = parseExternalDomainName(name);

		if (!parsed) {
			throw new DomainBlockedError(
				"Domain name must be an unreserved sld.tld name",
			);
		}

		return parsed;
	}

	private publicAvailability(
		name: string,
		catalog: (typeof DOMAIN_TLD_CATALOG)[DomainTld],
		availability: DomainAvailability | undefined,
	): DomainAvailabilityStatus {
		if (!availability) {
			return "unavailable";
		}

		if (availability.premium) {
			return "premium_blocked";
		}

		if (!availability.available) {
			return "unavailable";
		}

		if (
			typeof availability.wholesalePriceUsd !== "number" ||
			!Number.isFinite(availability.wholesalePriceUsd) ||
			availability.wholesalePriceUsd <= 0 ||
			availability.wholesalePriceUsd > catalog.wholesaleCeilingUsd
		) {
			return "premium_blocked";
		}

		if (isReservedDomainName(name)) {
			return "premium_blocked";
		}

		return "available";
	}

	private requiredRecords(
		_name: string,
		validationRecords: Array<{ name: string; type: "TXT"; value: string }>,
		row?: DomainRow,
	): RequiredDomainRecord[] {
		const dns = row ? domainDnsSchema.safeParse(row.dns) : null;
		const existingRecords = dns?.success ? (dns.data.records ?? []) : [];
		const validation = validationRecords.map((record) => ({
			name: record.name,
			purpose: "ownership_or_ssl_validation",
			type: record.type,
			value: record.value,
		}));
		const records = [
			{
				name: "www",
				purpose: "traffic",
				type: "CNAME",
				value: env.DOMAINS_FALLBACK_ORIGIN,
			},
			...validation,
		] satisfies RequiredDomainRecord[];
		const byKey = new Map<string, RequiredDomainRecord>();

		for (const record of [...existingRecords, ...records]) {
			byKey.set(`${record.type}:${record.name}:${record.value}`, record);
		}

		return [...byKey.values()];
	}

	private dnsWithRequiredRecords(records: RequiredDomainRecord[]): DomainDns {
		return { records };
	}

	private isHostnameActive(status: string) {
		return status === "active";
	}

	private assertRenewable(row: DomainRow): void {
		if (
			row.source !== "purchased" ||
			(row.status !== "active" && row.status !== "expired")
		) {
			throw new InvalidDomainStateError(
				"Only active or expired purchased domains can be renewed",
			);
		}
	}

	private icannLockedUntil(createdAt: Date): Date | null {
		const lockedUntil = new Date(createdAt);
		lockedUntil.setUTCDate(lockedUntil.getUTCDate() + 60);

		return lockedUntil > new Date() ? lockedUntil : null;
	}

	private async bestEffortDeleteCustomHostname(
		customHostnameId: string,
		domainId: string,
	): Promise<void> {
		try {
			await this.customHostnameService.deleteCustomHostname(customHostnameId);
		} catch (error) {
			this.logger.warn(
				`Failed to delete Cloudflare custom hostname for domain ${domainId}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async enqueueDomainJob(
		name: DomainJobName,
		data: DomainJobData,
		jobId: string,
		delay?: number,
	): Promise<void> {
		if (!isDomainQueueEnabled()) {
			this.logger.warn(
				`Domains queue disabled; ${name} for ${"domainId" in data ? data.domainId : "scheduler"} must be kicked later`,
			);
			return;
		}

		if (!this.domainsQueue) {
			this.logger.error(`Domains queue provider missing for ${name}`);
			return;
		}

		const options: JobsOptions = {
			...(delay ? { delay } : {}),
			...this.jobOptions(name),
			jobId,
		};

		await this.domainsQueue.add(name, data, {
			...options,
		});
	}

	private jobOptions(name: DomainJobName): JobsOptions {
		if (name === "domain-purchase") {
			return {
				attempts: 5,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
			};
		}

		if (name === "domain-configure") {
			return {
				attempts: 3,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
			};
		}

		return {};
	}

	assertDomainAvailable(
		name: string,
		availability: DomainAvailability | undefined,
	): void {
		if (!availability?.available) {
			throw new DomainNotAvailableError(name);
		}

		const parsed = this.parseSafeDomainName(name);
		const catalog = DOMAIN_TLD_CATALOG[parsed.tld];

		if (
			availability.premium ||
			typeof availability.wholesalePriceUsd !== "number" ||
			!Number.isFinite(availability.wholesalePriceUsd) ||
			availability.wholesalePriceUsd <= 0 ||
			availability.wholesalePriceUsd > catalog.wholesaleCeilingUsd
		) {
			throw new PremiumDomainBlockedError(name);
		}
	}
}

function isDomainQueueEnabled(): boolean {
	return process.env.QUEUE_ENABLED === undefined
		? env.QUEUE_ENABLED
		: process.env.QUEUE_ENABLED === "true";
}
