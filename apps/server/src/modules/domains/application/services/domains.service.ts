import { randomUUID } from "node:crypto";
import { Inject, Injectable, type Logger } from "@nestjs/common";
import {
	type AttachExternalDomainBody,
	type AttachExternalDomainResponse,
	type DetachDomainResponse,
	DOMAIN_TLD_CATALOG,
	type DomainAvailabilityStatus,
	type DomainTld,
	domainDnsSchema,
	domainRetailUsdCentsFromWholesale,
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
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	mergeRequiredDomainRecords,
	validationRequiredDomainRecords,
	wholesaleQuoteBlockReason,
	wwwCnameTrafficRecord,
} from "../../domain/domain-provisioning-rules";
import {
	DomainBlockedError,
	DomainNotAvailableError,
	ExternalDomainUnregisteredError,
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
import { CustomerZoneService } from "../../infrastructure/cloudflare/customer-zone.service";
import { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import { DomainRegistrationCheckService } from "../../infrastructure/dns/domain-registration-check.service";
import { mapDomain } from "../../infrastructure/mappers/domain.mapper";
import {
	type DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";
import {
	apexCustomHostnameIdOf,
	customerZoneIdOf,
} from "../fulfillment/domain-assets-cleanup";
import { withdrawnCustomerZoneDnsPatch } from "../fulfillment/withdrawn-customer-zone";

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
		@Inject(CustomerZoneService)
		private readonly customerZoneService: CustomerZoneService,
		@Inject(DomainRegistrationCheckService)
		private readonly domainRegistrationCheckService: DomainRegistrationCheckService,
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
					// publicAvailability already validates this quote as finite, positive,
					// and under the TLD ceiling. The quote itself never crosses the wire.
					registrationPriceUsd:
						publicAvailability === "available" &&
						typeof result?.wholesalePriceUsd === "number"
							? domainRetailUsdCentsFromWholesale(result.wholesalePriceUsd) /
								100
							: null,
					tld: candidate.tld,
				};
			}),
		};
	}

	async list(
		projectId: string,
		scope: ProjectScope,
	): Promise<ListDomainsResponse> {
		const rows = await this.domainsRepository.listByProject(projectId, scope);

		return { domains: rows.map(mapDomain) };
	}

	async preparePurchase(
		scope: ProjectScope,
		name: string,
		projectId?: string,
	): Promise<PreparedDomainPurchase> {
		const parsed = this.parseSafeDomainName(name);
		const catalog = DOMAIN_TLD_CATALOG[parsed.tld];

		if (projectId) {
			await this.domainsRepository.assertProjectAccessible(scope, projectId);
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
		scope: ProjectScope,
		projectId: string,
		body: AttachExternalDomainBody,
	): Promise<AttachExternalDomainResponse> {
		const parsed = this.parseSafeExternalDomainName(body.name);

		await this.domainsRepository.assertProjectAccessible(scope, projectId);
		const registration = await this.domainRegistrationCheckService.check(
			parsed.name,
		);

		if (registration.status === "unregistered") {
			throw new ExternalDomainUnregisteredError(parsed.name);
		}

		const row = await this.domainsRepository.createExternalReplacingTerminal({
			name: parsed.name,
			projectId,
			tld: parsed.tld,
			// Provenance: the acting member is recorded as the attacher.
			userId: scope.userId,
		});
		let customHostnameId: string | null = null;

		try {
			const hostname = await this.customHostnameService.createCustomHostname(
				parsed.name,
			);
			customHostnameId = hostname.id;
			const wwwRecords = this.requiredRecords(
				parsed.name,
				hostname.requiredRecords,
			);
			const updated = await this.domainsRepository.updateById(row.id, {
				cfCustomHostnameId: hostname.id,
				dns: { records: wwwRecords },
			});

			const nonce = String(updated.updatedAt.getTime());

			await this.domainTaskDispatcher.triggerConfiguration({
				domainId: updated.id,
				nonce,
			});

			return {
				domain: mapDomain(updated),
				requiredRecords: wwwRecords,
			};
		} catch (error) {
			if (customHostnameId) {
				await this.bestEffortDeleteCustomHostname(customHostnameId, row.id);
			}
			await this.domainsRepository.deleteById(row.id);
			throw error;
		}
	}

	async verify(id: string, scope: ProjectScope): Promise<VerifyDomainResponse> {
		const row = await this.domainsRepository.getByIdForScope(id, scope);

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
		// The nameservers shown for option A must belong to a zone that still
		// exists; otherwise they leave the records before they are handed back.
		const checked = await this.withdrawLostExternalZone(row);
		const requiredRecords = this.requiredRecords(
			checked.name,
			status.requiredRecords,
			checked,
		);
		const dns = domainDnsSchema.safeParse(checked.dns);
		const currentDns = dns.success ? dns.data : {};
		const current =
			checked.source === "external" &&
			!this.sameRequiredRecords(currentDns.records ?? [], requiredRecords)
				? ((await this.domainsRepository.mergeDnsIfStatus(
						checked.id,
						["configuring", "active"],
						{ records: requiredRecords },
					)) ??
					(await this.domainsRepository.getByIdForScope(checked.id, scope)))
				: checked;
		const hostnameActive = this.isHostnameActive(status.status);
		const externalConfiguring =
			current.source === "external" && current.status === "configuring";

		if (hostnameActive && !externalConfiguring) {
			const active = await this.activateDomain(current);

			return { domain: mapDomain(active), requiredRecords };
		}

		const pending =
			current.source === "external"
				? await this.redispatchExternalVerification(
						current,
						scope,
						hostnameActive && externalConfiguring,
					)
				: current;

		if (current.source === "purchased") {
			await this.domainTaskDispatcher.triggerConfiguration({
				domainId: current.id,
				nonce: `manual:${randomUUID()}`,
			});
		}

		return {
			domain: mapDomain(pending),
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
		scope: ProjectScope,
	): Promise<SetPrimaryDomainResponse> {
		const updated = await this.domainsRepository.setPrimary(id, scope);

		return { domain: mapDomain(updated) };
	}

	async detach(id: string, scope: ProjectScope): Promise<DetachDomainResponse> {
		const row = await this.domainsRepository.getByIdForScope(id, scope);

		if (row.status === "active") {
			await this.domainRoutingService.deleteDomainPointer(row.name);
		}

		if (row.cfCustomHostnameId) {
			await this.bestEffortDeleteCustomHostname(row.cfCustomHostnameId, row.id);
		}

		// Purchased and external domains may also hold an apex custom hostname
		// (recorded in dns).
		const apexCustomHostnameId = apexCustomHostnameIdOf(row.dns);

		if (apexCustomHostnameId) {
			await this.bestEffortDeleteCustomHostname(apexCustomHostnameId, row.id);
		}

		// The domain's Cloudflare zone stays: the registry (or the owner of an
		// external domain) still delegates to it, so deleting it would black-hole
		// the customer's DNS. Detach only releases the project attachment, never
		// the registration or its DNS.
		const zoneId = customerZoneIdOf(row.dns);

		if (zoneId) {
			this.logger.log(
				`Leaving Cloudflare zone ${zoneId} for detached domain ${row.id} in place`,
			);
		}

		const updated = await this.domainsRepository.detach(id, scope);

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

		const active =
			row.source === "external"
				? await this.domainsRepository.activateAndClearExternalVerification(
						row.id,
						["configuring"],
					)
				: await this.domainsRepository.updateIfStatusOrNull(
						row.id,
						["configuring"],
						{ error: null, status: "active" },
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

	private async redispatchExternalVerification(
		row: DomainRow,
		scope: ProjectScope,
		forceRestart = false,
	): Promise<DomainRow> {
		const dns = domainDnsSchema.safeParse(row.dns);
		const marker = dns.success ? dns.data.externalVerification : undefined;

		if (forceRestart) {
			return this.forceRestartExternalVerification(row.id, scope);
		}

		if (marker) {
			const restart =
				await this.domainsRepository.prepareExternalVerificationRestart(row.id);

			if (!restart) {
				const current = await this.domainsRepository.getByIdForScope(
					row.id,
					scope,
				);
				const currentDns = domainDnsSchema.safeParse(current.dns);

				if (
					current.status !== "configuring" ||
					!currentDns.success ||
					!currentDns.data.externalVerification
				) {
					return current;
				}

				throw new InvalidDomainStateError(
					"External domain verification could not be restarted",
				);
			}

			await this.domainTaskDispatcher.triggerConfiguration({
				domainId: row.id,
				nonce: restart.nonce,
			});
			await this.domainsRepository.clearExternalVerificationMarker(
				row.id,
				restart.stalledAt,
			);

			return this.domainsRepository.getByIdForScope(row.id, scope);
		}

		const cursor = await this.domainsRepository.readCursor(row.id);

		await this.domainTaskDispatcher.triggerConfiguration({
			domainId: row.id,
			nonce: cursor?.nonce ?? String(row.updatedAt.getTime()),
		});

		return this.domainsRepository.getByIdForScope(row.id, scope);
	}

	private async forceRestartExternalVerification(
		domainId: string,
		scope: ProjectScope,
	): Promise<DomainRow> {
		const nonce = `manual-restart:${randomUUID()}`;
		let expectedCursor = await this.domainsRepository.readCursor(domainId);

		for (let attempt = 0; attempt < 2; attempt += 1) {
			const restart =
				await this.domainsRepository.prepareExternalVerificationRestart(
					domainId,
					{
						expectedNonce: expectedCursor?.nonce ?? null,
						nonce,
					},
				);

			if (restart) {
				return this.handoffExternalVerificationRestart(
					domainId,
					scope,
					restart.nonce,
				);
			}

			const current = await this.domainsRepository.getByIdForScope(
				domainId,
				scope,
			);

			if (current.source !== "external" || current.status !== "configuring") {
				return current;
			}

			const winner = await this.domainsRepository.readCursor(domainId);

			if (
				winner &&
				winner.nonce !== expectedCursor?.nonce &&
				winner.nonce.startsWith("manual-restart:")
			) {
				return this.handoffExternalVerificationRestart(
					domainId,
					scope,
					winner.nonce,
				);
			}

			expectedCursor = winner;
		}

		throw new InvalidDomainStateError(
			"External domain verification could not be restarted",
		);
	}

	private async handoffExternalVerificationRestart(
		domainId: string,
		scope: ProjectScope,
		nonce: string,
	): Promise<DomainRow> {
		await this.domainTaskDispatcher.triggerConfiguration({ domainId, nonce });

		const current = await this.domainsRepository.getByIdForScope(
			domainId,
			scope,
		);
		const dns = domainDnsSchema.safeParse(current.dns);
		const marker = dns.success ? dns.data.externalVerification : undefined;

		if (!marker) {
			return current;
		}

		await this.domainsRepository.clearExternalVerificationMarker(
			domainId,
			marker.stalledAt,
		);

		return this.domainsRepository.getByIdForScope(domainId, scope);
	}

	/**
	 * Manual verify of an external row that exposes a zone: when that zone no
	 * longer exists in Cloudflare (deleted out of band, purged while pending),
	 * its nameservers are withdrawn from `dns.records` and the zone keys are
	 * cleared, so no UI keeps recommending option A for a zone nobody hosts. A
	 * `configuring` row is redispatched so the fulfillment runner can apply its
	 * current ownership gate before replacing the zone; an `active` row stays on
	 * option B. A failed check is logged and changes nothing.
	 */
	private async withdrawLostExternalZone(row: DomainRow): Promise<DomainRow> {
		const dns = domainDnsSchema.safeParse(row.dns);
		const zoneId = dns.success ? dns.data.zoneId : undefined;

		if (row.source !== "external" || !dns.success || !zoneId) {
			return row;
		}

		let status: string | null;

		try {
			status = await this.customerZoneService.getZoneStatus(zoneId);
		} catch (error) {
			this.logger.warn(
				`Cloudflare zone check deferred for external domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);

			return row;
		}

		if (status !== null) {
			return row;
		}

		this.logger.warn(
			`Cloudflare zone ${zoneId} for domain ${row.id} no longer exists; its nameservers are withdrawn`,
		);

		const withdrawn = await this.domainsRepository.mergeDnsIfStatus(
			row.id,
			["configuring", "active"],
			withdrawnCustomerZoneDnsPatch(dns.data, zoneId),
		);

		return withdrawn ?? row;
	}

	private sameRequiredRecords(
		current: readonly RequiredDomainRecord[],
		next: readonly RequiredDomainRecord[],
	): boolean {
		return (
			current.length === next.length &&
			current.every((record, index) => {
				const candidate = next[index];

				return (
					candidate?.name === record.name &&
					candidate.purpose === record.purpose &&
					candidate.type === record.type &&
					candidate.value === record.value
				);
			})
		);
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
