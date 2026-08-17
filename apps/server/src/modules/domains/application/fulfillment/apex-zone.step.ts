import { domainDnsSchema } from "@wandit/contracts";

import { canonicalDomainHost } from "../../domain/domain-hosts";
import {
	apexCnameTrafficRecord,
	DOMAIN_VALIDATION_RECORD_PURPOSE,
	mergeRequiredDomainRecords,
	nameserverRequiredDomainRecords,
	validationRequiredDomainRecords,
} from "../../domain/domain-provisioning-rules";
import type {
	CustomerZone,
	CustomerZoneDnsRecord,
	CustomHostnameResult,
	DomainApexDnsPatch,
	DomainFulfillmentDns,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

const APEX_ERROR_MAX_LENGTH = 240;

type ApexZoneProvider = {
	createZone(name: string): Promise<CustomerZone>;
	findZoneByName(name: string): Promise<CustomerZone | null>;
	getZoneStatus(id: string): Promise<string>;
	requestActivationCheck(id: string): Promise<void>;
	upsertDnsRecord(
		zoneId: string,
		record: CustomerZoneDnsRecord,
	): Promise<unknown>;
};

type ApexCustomHostnameProvider = {
	createApexCustomHostname(host: string): Promise<CustomHostnameResult>;
	deleteCustomHostname(id: string): Promise<void>;
	findCustomHostnameByName(
		hostname: string,
	): Promise<CustomHostnameResult | null>;
	getCustomHostnameStatus(id: string): Promise<CustomHostnameResult>;
	refreshCustomHostnameValidation(id: string): Promise<CustomHostnameResult>;
};

type ApexZoneRegistrar = {
	setNameservers(name: string, nameservers: string[]): Promise<void>;
};

/**
 * Persists only the apex-owned `dns` keys as a shallow merge into the stored
 * `dns` object, fenced on a live status, and returns the fresh row. It must
 * throw when the fence loses so the step can record (or drop) the outcome.
 */
type ApexZoneState = {
	persistApexDns(
		row: DomainFulfillmentRow,
		patch: DomainApexDnsPatch,
	): Promise<DomainFulfillmentRow>;
};

type ApexZoneStepOptions = {
	/** DOMAINS_APEX_ZONE_ENABLED: off means the registrar forwarding stays. */
	enabled: boolean;
	fallbackOrigin: string;
};

/**
 * Serves the bare apex of a PURCHASED domain through Cloudflare for SaaS by
 * hosting the domain's DNS in a Cloudflare zone of OUR account: find-or-create
 * the zone, find-or-create a bare-name custom hostname, write DNS-only CNAMEs
 * (apex + www → fallback origin) and both hostnames' ownership TXT records
 * into the zone, delegate the registrar's nameservers to the zone, and ask
 * Cloudflare to check the delegation. The edge then redirects apex → www.
 *
 * Best-effort contract: `execute` never throws. Any failure is logged, kept in
 * `dns.apexError`, and the latest row is returned, so the www path
 * (registration → www DNS → www hostname → verification → activation) is never
 * failed or delayed. `dns.zoneDelegated` is written right before the registrar
 * call (so cleanup never deletes a zone the registry may delegate to) and
 * `dns.apexConfigured` is the durable done marker; after it,
 * `execute` only polls the zone (pending → activation check) and, once the zone
 * is active, nudges the apex hostname's validation exactly once. The purchase
 * pipeline runs the step once while the row is `registering` and again on
 * every verification probe while the row is `configuring`; a row that reaches
 * `active` without the marker is only retried by `domains:backfill-apex`.
 */
export class ApexZoneStep {
	constructor(
		private readonly zones: ApexZoneProvider,
		private readonly customHostnames: ApexCustomHostnameProvider,
		private readonly registrar: ApexZoneRegistrar,
		private readonly state: ApexZoneState,
		private readonly logger: DomainFulfillmentLogger,
		private readonly options: ApexZoneStepOptions,
	) {}

	async execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow> {
		if (row.source !== "purchased" || !this.options.enabled) {
			return row;
		}

		const dns = this.dnsState(row);

		return dns.apexConfigured
			? this.verify(row, dns)
			: this.configure(row, dns);
	}

	private async configure(
		row: DomainFulfillmentRow,
		initialDns: DomainFulfillmentDns,
	): Promise<DomainFulfillmentRow> {
		let current = row;
		let dns = initialDns;

		try {
			let zone: CustomerZone;

			if (dns.zoneId && dns.zoneNameServers && dns.zoneNameServers.length > 0) {
				zone = {
					id: dns.zoneId,
					nameServers: dns.zoneNameServers,
					status: dns.zoneStatus ?? "pending",
				};
			} else {
				// Look up by name first so a retry (or the backfill) adopts the zone
				// an earlier pass or an operator created instead of a duplicate error.
				const adopted = await this.zones.findZoneByName(current.name);
				zone = adopted ?? (await this.zones.createZone(current.name));
				current = await this.state.persistApexDns(current, {
					...(adopted ? {} : { zoneCreated: true }),
					zoneId: zone.id,
					zoneNameServers: zone.nameServers,
					zoneStatus: zone.status,
				});
				dns = this.dnsState(current);
			}

			let hostname: CustomHostnameResult;

			if (dns.apexCustomHostnameId) {
				hostname = await this.customHostnames.getCustomHostnameStatus(
					dns.apexCustomHostnameId,
				);
			} else {
				const adopted = await this.customHostnames.findCustomHostnameByName(
					current.name,
				);
				hostname =
					adopted ??
					(await this.customHostnames.createApexCustomHostname(current.name));

				try {
					current = await this.state.persistApexDns(current, {
						apexCustomHostnameId: hostname.id,
						apexCustomHostnameStatus: hostname.status,
						records: mergeRequiredDomainRecords(
							dns.records ?? [],
							validationRequiredDomainRecords(hostname.requiredRecords),
						),
					});
				} catch (error) {
					// Without a persisted id no cleanup site can ever find a hostname
					// this pass created, so release it; an adopted one is left alone.
					if (!adopted) {
						await this.deleteUnclaimedHostname(hostname.id);
					}

					throw error;
				}

				dns = this.dnsState(current);
			}

			// The www hostname's ownership TXT is already in dns.records (written at
			// the registrar); the apex hostname's comes from its create/get result.
			// Both must exist in the zone, which is authoritative once NS move.
			const validationRecords = mergeRequiredDomainRecords(
				(dns.records ?? []).filter(
					(record) => record.purpose === DOMAIN_VALIDATION_RECORD_PURPOSE,
				),
				validationRequiredDomainRecords(hostname.requiredRecords),
			);
			const trafficRecords: CustomerZoneDnsRecord[] = [
				{
					content: this.options.fallbackOrigin,
					name: current.name,
					proxied: false,
					type: "CNAME",
				},
				{
					content: this.options.fallbackOrigin,
					name: canonicalDomainHost(current.name),
					proxied: false,
					type: "CNAME",
				},
			];

			for (const record of trafficRecords) {
				await this.zones.upsertDnsRecord(zone.id, record);
			}

			for (const record of validationRecords) {
				await this.zones.upsertDnsRecord(zone.id, {
					content: record.value,
					name: this.fullyQualified(current.name, record.name),
					type: "TXT",
				});
			}

			// Durable "delegation may be live" marker BEFORE the registrar call: a
			// timed-out or fence-racing call can still have been applied by the
			// registrar, and the terminal-failure cleanup must never delete a zone
			// the registry delegates to. When this fenced write fails, the
			// nameservers are not touched.
			current = await this.state.persistApexDns(current, {
				zoneDelegated: true,
			});
			dns = this.dnsState(current);

			await this.registrar.setNameservers(current.name, zone.nameServers);
			await this.bestEffortActivationCheck(current, zone.id);

			return await this.state.persistApexDns(current, {
				apexConfigured: true,
				apexError: null,
				records: mergeRequiredDomainRecords(
					dns.records ?? [],
					validationRecords,
					[apexCnameTrafficRecord(this.options.fallbackOrigin)],
					nameserverRequiredDomainRecords(zone.nameServers),
				),
			});
		} catch (error) {
			return this.recordApexError(current, error);
		}
	}

	/**
	 * Post-configuration polling: while the zone is pending, read its status
	 * (and ask for an activation check); once active, nudge the apex hostname
	 * once so Cloudflare re-validates it now instead of on its own schedule.
	 * Domain activation never waits on any of this.
	 */
	private async verify(
		row: DomainFulfillmentRow,
		initialDns: DomainFulfillmentDns,
	): Promise<DomainFulfillmentRow> {
		let current = row;
		let dns = initialDns;

		if (!dns.zoneId) {
			return current;
		}

		try {
			if (!dns.zoneActive) {
				const status = await this.zones.getZoneStatus(dns.zoneId);

				if (status !== "active") {
					await this.bestEffortActivationCheck(current, dns.zoneId);

					return status === dns.zoneStatus
						? current
						: await this.state.persistApexDns(current, { zoneStatus: status });
				}

				current = await this.state.persistApexDns(current, {
					zoneActive: true,
					zoneStatus: status,
				});
				dns = this.dnsState(current);
			}

			if (dns.apexCustomHostnameId && !dns.apexCustomHostnameNudged) {
				const hostname =
					await this.customHostnames.refreshCustomHostnameValidation(
						dns.apexCustomHostnameId,
					);
				current = await this.state.persistApexDns(current, {
					apexCustomHostnameNudged: true,
					apexCustomHostnameStatus: hostname.status,
				});
			}

			return current;
		} catch (error) {
			this.logger.warn(
				`Apex zone verification deferred for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);

			return current;
		}
	}

	private async bestEffortActivationCheck(
		row: DomainFulfillmentRow,
		zoneId: string,
	): Promise<void> {
		try {
			await this.zones.requestActivationCheck(zoneId);
		} catch (error) {
			// Cloudflare re-checks pending zones on its own; a refused nudge
			// (Free zones accept one per hour) must not fail the apex pass.
			this.logger.warn(
				`Cloudflare zone activation check refused for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private async recordApexError(
		row: DomainFulfillmentRow,
		error: unknown,
	): Promise<DomainFulfillmentRow> {
		const message = error instanceof Error ? error.message : String(error);

		this.logger.warn(
			`Apex zone configuration deferred for domain ${row.id}`,
			message,
		);

		try {
			return await this.state.persistApexDns(row, {
				apexError: message.slice(0, APEX_ERROR_MAX_LENGTH),
			});
		} catch (persistError) {
			this.logger.warn(
				`Failed to persist apex error for domain ${row.id}`,
				persistError instanceof Error
					? persistError.message
					: String(persistError),
			);

			return row;
		}
	}

	private async deleteUnclaimedHostname(id: string): Promise<void> {
		try {
			await this.customHostnames.deleteCustomHostname(id);
		} catch (error) {
			this.logger.warn(
				`Failed to delete unclaimed Cloudflare apex custom hostname ${id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	/** Zone records take FQDNs; stored records may be relative ("www", "@"). */
	private fullyQualified(domainName: string, recordName: string): string {
		const apex = domainName.toLowerCase();
		const name = recordName.trim().toLowerCase().replace(/\.$/, "");

		if (name === "" || name === "@" || name === apex) {
			return apex;
		}

		return name.endsWith(`.${apex}`) ? name : `${name}.${apex}`;
	}

	private dnsState(row: DomainFulfillmentRow): DomainFulfillmentDns {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
	}
}
