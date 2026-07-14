import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, type Logger, Optional } from "@nestjs/common";
import {
	type AttachExternalDomainBody,
	type AttachExternalDomainResponse,
	catalogFor,
	type DetachDomainResponse,
	DOMAIN_TLD_CATALOG,
	type DomainAvailabilityStatus,
	type DomainDns,
	type DomainPriceSnapshot,
	type DomainTld,
	domainDnsSchema,
	domainPriceSnapshotSchema,
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
	DomainsUnavailableError,
	InvalidDomainStateError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import {
	CREDITS_PORT,
	type CreditsPort,
} from "../../domain/ports/credits.port";
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
		@Inject(CREDITS_PORT)
		private readonly creditsPort: CreditsPort,
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

				return {
					availability: this.publicAvailability(
						candidate.name,
						catalog,
						result,
					),
					name: candidate.name,
					registrationCredits: catalog.registrationCredits,
					renewalCredits: catalog.renewalCredits,
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
		const priceSnapshot = this.priceSnapshot(parsed.tld);

		await this.domainsRepository.assertProjectOwned(userId, projectId);
		this.assertDomainQueueAvailable();

		const [availability] = await this.domainProvider.checkAvailability([
			parsed.name,
		]);
		this.assertDomainAvailable(parsed.name, availability);

		// The domain row is created before consuming credits so the ledger
		// idempotency key can be derived from the durable row id. If consume
		// rejects, the row is deleted before the error is rethrown; queueing only
		// happens after consume succeeds, preserving no-row/no-charge invariants.
		const row = await this.domainsRepository.createPurchasedReplacingTerminal({
			name: parsed.name,
			priceSnapshot,
			projectId,
			registrant: body.registrant,
			tld: parsed.tld,
			userId,
		});

		try {
			await this.creditsPort.consume(
				userId,
				priceSnapshot.registrationCredits,
				{
					idempotencyKey: `domain-purchase:${row.id}`,
					meta: {
						domainId: row.id,
						name: row.name,
						reason: "domain_purchase",
					},
				},
			);
		} catch (error) {
			await this.domainsRepository.deleteById(row.id);
			throw error;
		}

		await this.enqueueDomainJob(
			"domain-purchase",
			{ domainId: row.id },
			`domain-purchase:${row.id}`,
		);

		return { domain: mapDomain(row) };
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

		const priceSnapshot = this.expectPriceSnapshot(row);
		const periodEndYear = this.nextExpiryYear(row);
		const attemptUpdatedAtMs = row.updatedAt.getTime();
		const idempotencyKey = `domain-renew:${row.id}:${periodEndYear}:${attemptUpdatedAtMs}`;

		await this.creditsPort.consume(userId, priceSnapshot.renewalCredits, {
			idempotencyKey,
			meta: {
				domainId: row.id,
				name: row.name,
				reason: "domain_renewal",
			},
		});

		try {
			const renewed = await this.domainProvider.renew(row.name, 1);
			const expiresAt =
				renewed.expiresAt ?? this.addYears(row.expiresAt ?? new Date(), 1);
			const updated = await this.domainsRepository.updateById(row.id, {
				error: null,
				expiresAt,
				status: "active",
			});

			return { domain: mapDomain(updated) };
		} catch (error) {
			await this.domainsRepository.recordRenewalNotice(
				row.id,
				"Renewal failed; credits were refunded and the next retry will use a fresh charge attempt",
			);
			await this.creditsPort.grant(userId, priceSnapshot.renewalCredits, {
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

	async setAutoRenew(
		id: string,
		userId: string,
		body: UpdateDomainAutoRenewBody,
	): Promise<UpdateDomainAutoRenewResponse> {
		await this.domainsRepository.getByIdForUser(id, userId);
		const updated = await this.domainsRepository.updateById(id, {
			autoRenew: body.autoRenew,
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

		if (row.source !== "purchased" || row.status === "failed") {
			throw new InvalidDomainStateError(
				"Only purchased domains can be unlocked for transfer",
			);
		}

		await this.domainProvider.setTransferLock(row.name, false);
		const authCode = await this.domainProvider.getAuthCode(row.name);
		const lockedUntil = this.icannLockedUntil(row.createdAt);

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

		if (
			typeof availability.wholesalePriceUsd === "number" &&
			availability.wholesalePriceUsd > catalog.wholesaleCeilingUsd
		) {
			return "premium_blocked";
		}

		if (!availability.available) {
			return "unavailable";
		}

		if (isReservedDomainName(name)) {
			return "premium_blocked";
		}

		return "available";
	}

	private priceSnapshot(tld: DomainTld): DomainPriceSnapshot {
		const catalog = catalogFor(tld);

		if (!catalog) {
			throw new DomainBlockedError("Unsupported domain TLD");
		}

		return {
			registrationCredits: catalog.registrationCredits,
			renewalCredits: catalog.renewalCredits,
			tld,
			wholesaleCeilingUsd: catalog.wholesaleCeilingUsd,
		};
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

	private expectPriceSnapshot(row: DomainRow): DomainPriceSnapshot {
		const parsed = domainPriceSnapshotSchema.safeParse(row.priceSnapshot);

		if (!parsed.success) {
			throw new InvalidDomainStateError("Domain is missing its price snapshot");
		}

		return parsed.data;
	}

	private nextExpiryYear(row: DomainRow): number {
		return (row.expiresAt ?? new Date()).getUTCFullYear() + 1;
	}

	private addYears(date: Date, years: number): Date {
		const copy = new Date(date);
		copy.setUTCFullYear(copy.getUTCFullYear() + years);

		return copy;
	}

	private icannLockedUntil(createdAt: Date): Date | null {
		const lockedUntil = new Date(createdAt);
		lockedUntil.setUTCDate(lockedUntil.getUTCDate() + 60);

		return lockedUntil > new Date() ? lockedUntil : null;
	}

	private assertDomainQueueAvailable(): void {
		if (!isDomainQueueEnabled()) {
			this.logger.warn(
				"Domain purchase rejected because QUEUE_ENABLED is false",
			);
			throw new DomainsUnavailableError();
		}
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
			(typeof availability.wholesalePriceUsd === "number" &&
				availability.wholesalePriceUsd > catalog.wholesaleCeilingUsd)
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
