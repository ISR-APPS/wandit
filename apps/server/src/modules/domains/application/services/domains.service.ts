import { randomUUID } from "node:crypto";

import { Inject, Injectable, type Logger } from "@nestjs/common";
import {
	type AttachExternalDomainBody,
	type AttachExternalDomainResponse,
	type DetachDomainResponse,
	DOMAIN_REGISTRATION_USD_CENTS,
	DOMAIN_TLD_CATALOG,
	type DomainAvailabilityStatus,
	type DomainDns,
	type DomainTld,
	domainDnsSchema,
	domainTlds,
	isReservedDomainName,
	isValidDomainLabel,
	type ListDomainsResponse,
	parseDomainName,
	parseExternalDomainName,
	type RequiredDomainRecord,
	type SearchDomainsResponse,
	type SetPrimaryDomainResponse,
	type TransferUnlockDomainResponse,
	type UpdateDomainAutoRenewBody,
	type UpdateDomainAutoRenewResponse,
	type VerifyDomainResponse,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	mergeRequiredDomainRecords,
	validationRequiredDomainRecords,
	wholesaleQuoteBlockReason,
	wwwCnameTrafficRecord,
} from "../../domain/domain-provisioning-rules";
import {
	DomainBlockedError,
	DomainNotAvailableError,
	InvalidDomainStateError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import {
	DOMAIN_PROVIDER,
	type DomainAvailability,
	type DomainProvider,
} from "../../domain/ports/domain-provider.port";
import {
	DOMAIN_TASK_DISPATCHER,
	type DomainTaskDispatcher,
} from "../../domain/ports/domain-task-dispatcher.port";
import { CustomHostnameService } from "../../infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import { mapDomain } from "../../infrastructure/mappers/domain.mapper";
import {
	type DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";

export const DOMAINS_LOGGER = Symbol("DOMAINS_LOGGER");

type DomainLogger = Pick<Logger, "error" | "log" | "warn">;

export type PreparedDomainPurchase = {
	name: string;
	// The registrar's live wholesale quote, already validated against the
	// TLD ceiling. OrdersService freezes it into the order's price snapshot.
	quotedWholesaleUsd: number;
	tld: DomainTld;
	wholesaleCeilingUsd: number;
};

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
		@Inject(DOMAIN_TASK_DISPATCHER)
		private readonly domainTaskDispatcher: DomainTaskDispatcher,
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
				const publicAvailability = this.publicAvailability(
					candidate.name,
					catalog,
					result,
				);

				return {
					availability: publicAvailability,
					name: candidate.name,
					// Retail price from the catalog, only for safely purchasable
					// results. The registrar's wholesale quote never crosses the wire.
					registrationPriceUsd:
						publicAvailability === "available"
							? DOMAIN_REGISTRATION_USD_CENTS[candidate.tld] / 100
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

	async preparePurchase(
		userId: string,
		name: string,
		projectId?: string,
	): Promise<PreparedDomainPurchase> {
		const parsed = this.parseSafeDomainName(name);
		const catalog = DOMAIN_TLD_CATALOG[parsed.tld];

		if (projectId) {
			await this.domainsRepository.assertProjectOwned(userId, projectId);
		}
		this.domainTaskDispatcher.assertAvailable();

		const [availability] = await this.domainProvider.checkAvailability([
			parsed.name,
		]);
		this.assertDomainAvailable(parsed.name, availability);

		const quotedWholesaleUsd = availability?.wholesalePriceUsd;

		// assertDomainAvailable already fail-closes on a missing quote; this
		// re-check only exists so the type system carries the guarantee forward.
		if (typeof quotedWholesaleUsd !== "number") {
			throw new PremiumDomainBlockedError(parsed.name);
		}

		return {
			name: parsed.name,
			quotedWholesaleUsd,
			tld: parsed.tld,
			wholesaleCeilingUsd: catalog.wholesaleCeilingUsd,
		};
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

			await this.domainTaskDispatcher.triggerConfiguration({
				domainId: updated.id,
				nonce,
			});

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

		if (row.status !== "configuring" && row.status !== "active") {
			throw new InvalidDomainStateError(
				"Only configuring domains can be verified",
			);
		}

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

		await this.domainTaskDispatcher.triggerConfiguration({
			domainId: row.id,
			nonce: `manual:${randomUUID()}`,
		});

		return {
			domain: mapDomain(row),
			requiredRecords,
		};
	}

	async setAutoRenew(
		id: string,
		userId: string,
		body: UpdateDomainAutoRenewBody,
	): Promise<UpdateDomainAutoRenewResponse> {
		// Paid renewals are not wired yet (no `domain_renewal` payment-order
		// kind), so enabling auto-renew would promise a charge that cannot run.
		if (body.autoRenew) {
			throw new InvalidDomainStateError(
				"Automatic renewal is not available yet",
			);
		}

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
		// Keep the API path aligned with DomainActivationStep: publish the pointer
		// before the configuring->active CAS, accept an active CAS winner, and
		// remove the pointer after any other race.
		if (!row.projectId) {
			throw new InvalidDomainStateError(
				"Domain must be attached to a project before activation",
			);
		}

		if (row.status === "active") {
			return row;
		}

		if (row.status !== "configuring") {
			throw new InvalidDomainStateError(
				"Only configuring domains can be activated",
			);
		}

		await this.domainRoutingService.putDomainPointer(row.name, {
			projectId: row.projectId,
			source: "domain",
		});

		const active = await this.domainsRepository.updateIfStatusOrNull(
			row.id,
			["configuring"],
			{
				error: null,
				status: "active",
			},
		);

		if (active) {
			return active;
		}

		const current = await this.domainsRepository.getByIdForUser(
			row.id,
			row.userId,
		);

		if (current.status === "active") {
			return current;
		}

		await this.bestEffortDeleteDomainPointer(row.name, row.id);

		throw new InvalidDomainStateError(
			"Domain state changed before activation completed",
		);
	}

	private async bestEffortDeleteDomainPointer(
		name: string,
		domainId: string,
	): Promise<void> {
		try {
			await this.domainRoutingService.deleteDomainPointer(name);
		} catch (error) {
			this.logger.warn(
				`Failed to delete domain routing pointer for ${domainId}`,
				error instanceof Error ? error.message : String(error),
			);
		}
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

		const quoteBlockReason = wholesaleQuoteBlockReason(
			availability,
			catalog.wholesaleCeilingUsd,
			{ rejectNonPositive: true },
		);

		if (quoteBlockReason === "premium") {
			return "premium_blocked";
		}

		if (!availability.available) {
			return "unavailable";
		}

		// Fail closed: a missing, non-finite, or over-ceiling wholesale quote
		// means the purchase could lose money, so it is never shown as buyable.
		if (quoteBlockReason) {
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
		const validation = validationRequiredDomainRecords(validationRecords);
		const records = [
			wwwCnameTrafficRecord(env.DOMAINS_FALLBACK_ORIGIN),
			...validation,
		] satisfies RequiredDomainRecord[];

		return mergeRequiredDomainRecords(existingRecords, records);
	}

	private dnsWithRequiredRecords(records: RequiredDomainRecord[]): DomainDns {
		return { records };
	}

	private isHostnameActive(status: string) {
		return status === "active";
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
			wholesaleQuoteBlockReason(availability, catalog.wholesaleCeilingUsd, {
				rejectNonPositive: true,
			})
		) {
			throw new PremiumDomainBlockedError(name);
		}
	}
}
