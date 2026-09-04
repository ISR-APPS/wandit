import {
	type DomainSource,
	domainDnsSchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";

import { canonicalDomainHost } from "../../domain/domain-hosts";
import {
	DOMAIN_VALIDATION_RECORD_PURPOSE,
	mergeRequiredDomainRecords,
	nameserverRequiredDomainRecords,
	validationRequiredDomainRecords,
} from "../../domain/domain-provisioning-rules";
import type {
	CustomerZone,
	CustomerZoneDnsRecord,
	CustomerZoneDnsRecordDeletion,
	CustomerZoneDnsScan,
	CustomHostnameResult,
	DomainApexDnsPatch,
	DomainFulfillmentDns,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import { withdrawnCustomerZoneDnsPatch } from "./withdrawn-customer-zone";

const APEX_ERROR_MAX_LENGTH = 240;
/** Address records that would block our traffic CNAME (Cloudflare 81053). */
const TRAFFIC_CONFLICT_RECORD_TYPES = ["A", "AAAA", "CNAME"] as const;

type ApexZoneProvider = {
	createZone(name: string): Promise<CustomerZone>;
	deleteDnsRecords(
		zoneId: string,
		input: CustomerZoneDnsRecordDeletion,
	): Promise<unknown>;
	disableProxyOnAllRecords(zoneId: string): Promise<unknown>;
	findZoneByName(name: string): Promise<CustomerZone | null>;
	/** `null` when the zone no longer exists. */
	getZoneStatus(id: string): Promise<string | null>;
	requestActivationCheck(id: string): Promise<void>;
	scanDnsRecords(zoneId: string): Promise<CustomerZoneDnsScan>;
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
	/**
	 * DOMAINS_APEX_ZONE_ENABLED: off means no NEW zone (the registrar
	 * forwarding stays for a purchased apex). An external row that already
	 * exposed its zone's nameservers (`dns.zoneId`) is still finished: its owner
	 * may have delegated already and nothing else can fill that zone.
	 */
	enabled: boolean;
	fallbackOrigin: string;
	/** Row sources this composition handles; every other row is returned as is. */
	sources: readonly DomainSource[];
};

export type ApexZoneExecutionOptions = {
	/**
	 * Allows a missing zone to be found, adopted, or created. Existing zones
	 * are always maintained, even when this is false.
	 */
	allowZoneCreation: boolean;
};

/**
 * Serves the bare apex of a domain through Cloudflare for SaaS by hosting the
 * domain's DNS in a Cloudflare zone of OUR account: find-or-create the zone,
 * write the www traffic CNAME and the www hostname's ownership TXT into it,
 * find-or-create a bare-name custom hostname, write the apex CNAME and that
 * hostname's ownership TXT, get the nameservers delegated to the zone, and ask
 * Cloudflare to check the delegation. The edge then redirects apex → www.
 *
 * The www records go into the zone BEFORE the apex hostname exists: an owner
 * who already delegated to the zone (external option A, or a purchased zone on
 * a retry) must never lose www because the apex hostname cannot be created.
 *
 * PURCHASED rows (purchase runtime, backfill): the registrar's nameservers are
 * moved by us; `dns.zoneDelegated` is written right before that call so
 * cleanup never deletes a zone the registry may delegate to.
 *
 * EXTERNAL rows (configuration runtime): the user delegates at their registrar
 * with the zone's nameservers, which are exposed as `NS` records in
 * `dns.records` as soon as the zone exists (together with `zoneDelegated`, so
 * cleanup never deletes the zone). Once per zone the domain's current public
 * DNS is imported into it (`zoneScanned`) and turned DNS-only, so mail and
 * subdomains keep working after the switch; conflicting address records at the
 * apex and www names then make room for our traffic CNAMEs. No registrar call.
 *
 * A zone that no longer exists (deleted out of band, purged by Cloudflare) is
 * withdrawn as soon as a pass notices it: its nameservers leave `dns.records`
 * and the zone keys are cleared. A replacement is only provisioned when that
 * pass is authorized to create a zone.
 *
 * Best-effort contract: `execute` never throws. Any failure is logged, kept in
 * `dns.apexError`, and the latest row is returned, so the www path
 * (registration → www DNS → www hostname → verification → activation) is never
 * failed or delayed. `dns.apexConfigured` is the durable done marker; after it,
 * `execute` only polls the zone (pending → activation check) and, once the zone
 * is active, nudges the apex hostname's validation exactly once. The purchase
 * pipeline runs the step once while the row is `registering` and again on
 * every verification probe while the row is `configuring`; the configuration
 * pipeline (`domain-configure`) probes external ownership first, then runs it
 * with an explicit missing-zone creation authorization.
 * A purchased row that reaches `active` without the marker is only retried by
 * `domains:backfill-apex`.
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

	async execute(
		row: DomainFulfillmentRow,
		execution: ApexZoneExecutionOptions,
	): Promise<DomainFulfillmentRow> {
		if (!this.options.sources.includes(row.source)) {
			return row;
		}

		const dns = this.dnsState(row);

		if (!this.options.enabled && !this.carriesExposedZone(row, dns)) {
			return row;
		}

		return dns.apexConfigured
			? this.verify(row, dns)
			: this.configure(row, dns, execution.allowZoneCreation);
	}

	private async configure(
		row: DomainFulfillmentRow,
		initialDns: DomainFulfillmentDns,
		allowZoneCreation: boolean,
	): Promise<DomainFulfillmentRow> {
		let current = row;
		let dns = initialDns;
		const external = row.source === "external";

		try {
			let zone: CustomerZone | null = null;

			if (dns.zoneId) {
				const status = await this.zones.getZoneStatus(dns.zoneId);

				if (status === null) {
					current = await this.withdrawLostZone(current, dns, dns.zoneId);
					dns = this.dnsState(current);
				} else {
					zone = {
						id: dns.zoneId,
						nameServers: dns.zoneNameServers ?? [],
						status,
					};
				}
			}

			if (!zone) {
				if (!this.options.enabled || !allowZoneCreation) {
					return current;
				}

				// Look up by name first so a retry (or the backfill) adopts the zone
				// an earlier pass or an operator created instead of a duplicate error.
				const adopted = await this.zones.findZoneByName(current.name);
				zone = adopted ?? (await this.zones.createZone(current.name));
				current = await this.state.persistApexDns(current, {
					...(adopted ? {} : { zoneCreated: true }),
					zoneId: zone.id,
					zoneNameServers: zone.nameServers,
					zoneStatus: zone.status,
					// External: the user needs the nameservers right away, and may
					// delegate at any time from here on, so both land in ONE write.
					...(external
						? {
								records: mergeRequiredDomainRecords(
									dns.records ?? [],
									nameserverRequiredDomainRecords(zone.nameServers),
								),
								zoneDelegated: true,
								zoneNameserversExposedAt: new Date().toISOString(),
							}
						: {}),
				});
				dns = this.dnsState(current);
			}

			current = await this.importExistingDnsOnce(current, dns, zone.id);
			dns = this.dnsState(current);

			// The www path first: its traffic CNAME and the www hostname's ownership
			// TXT (already in dns.records: written at the registrar or handed to
			// the user) must be in the zone before anything apex-specific can fail.
			await this.writeTrafficRecord(zone.id, canonicalDomainHost(current.name));
			await this.writeValidationRecords(
				zone.id,
				current.name,
				(dns.records ?? []).filter(
					(record) => record.purpose === DOMAIN_VALIDATION_RECORD_PURPOSE,
				),
			);

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

			// The apex hostname's ownership TXT comes from its create/get result.
			// Neither TXT is merged into dns.records: they live inside OUR zone
			// and are nothing the user must do.
			await this.writeTrafficRecord(zone.id, current.name);
			await this.writeValidationRecords(
				zone.id,
				current.name,
				validationRequiredDomainRecords(hostname.requiredRecords),
			);

			if (!external) {
				// Durable "delegation may be live" marker BEFORE the registrar call: a
				// timed-out or fence-racing call can still have been applied by the
				// registrar, and the terminal-failure cleanup must never delete a zone
				// the registry delegates to. When this fenced write fails, the
				// nameservers are not touched. External rows carry the marker since
				// the zone write and delegate at their own registrar.
				current = await this.state.persistApexDns(current, {
					zoneDelegated: true,
				});
				dns = this.dnsState(current);

				await this.registrar.setNameservers(current.name, zone.nameServers);
			}

			await this.bestEffortActivationCheck(current, zone.id);

			// Only the nameservers reach dns.records (what the UI shows and what
			// diagnostics resolve); the apex CNAME and TXT stay inside our zone.
			return await this.state.persistApexDns(current, {
				apexConfigured: true,
				apexError: null,
				records: mergeRequiredDomainRecords(
					dns.records ?? [],
					nameserverRequiredDomainRecords(zone.nameServers),
				),
			});
		} catch (error) {
			return this.recordApexError(current, error);
		}
	}

	/**
	 * External only, once per zone (`dns.zoneScanned`): import the domain's
	 * current public DNS so mail and subdomains survive the nameserver switch,
	 * then make every imported record DNS-only (our zone hosts DNS, it proxies
	 * nothing). The normalization runs whatever the scan reported: a client-side
	 * timeout does not stop Cloudflare from finishing the import server-side.
	 * A provider failure is logged and skipped without the marker, so the next
	 * configure pass — or a verify pass while the zone is still pending —
	 * retries; the rest of the apex pass continues either way.
	 */
	private async importExistingDnsOnce(
		row: DomainFulfillmentRow,
		dns: DomainFulfillmentDns,
		zoneId: string,
	): Promise<DomainFulfillmentRow> {
		if (row.source !== "external" || dns.zoneScanned === true) {
			return row;
		}

		let scan: CustomerZoneDnsScan | null = null;

		try {
			scan = await this.zones.scanDnsRecords(zoneId);
		} catch (error) {
			this.logger.warn(
				`Existing DNS import into the Cloudflare zone deferred for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}

		let normalized = false;

		try {
			await this.zones.disableProxyOnAllRecords(zoneId);
			normalized = true;
		} catch (error) {
			this.logger.warn(
				`DNS-only normalization of the Cloudflare zone deferred for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}

		if (!scan || !normalized) {
			return row;
		}

		return this.state.persistApexDns(row, {
			zoneScanRecordsAdded: scan.recordsAdded,
			zoneScanned: true,
		});
	}

	/**
	 * Post-configuration polling: while the zone is pending, read its status
	 * (and ask for an activation check); once active, nudge the apex hostname
	 * once so Cloudflare re-validates it now instead of on its own schedule.
	 * A zone that disappeared is withdrawn from the row instead. Domain
	 * activation never waits on any of this.
	 */
	private async verify(
		row: DomainFulfillmentRow,
		initialDns: DomainFulfillmentDns,
	): Promise<DomainFulfillmentRow> {
		let current = row;
		let dns = initialDns;
		const zoneId = dns.zoneId;

		if (!zoneId) {
			return current;
		}

		try {
			if (!dns.zoneActive) {
				// A deferred external DNS import is still worth a retry while the
				// public DNS is not ours yet (the zone is not active).
				current = await this.importExistingDnsOnce(current, dns, zoneId);
				dns = this.dnsState(current);

				const status = await this.zones.getZoneStatus(zoneId);

				if (status === null) {
					return await this.withdrawLostZone(current, dns, zoneId);
				}

				if (status !== "active") {
					await this.bestEffortActivationCheck(current, zoneId);

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

	/**
	 * Our traffic CNAME at one name, DNS-only, after the imported (or hand-made)
	 * address records there made room for it: Cloudflare refuses a CNAME next
	 * to an A/AAAA/CNAME.
	 */
	private async writeTrafficRecord(
		zoneId: string,
		name: string,
	): Promise<void> {
		await this.zones.deleteDnsRecords(zoneId, {
			keepContent: this.options.fallbackOrigin,
			name,
			types: TRAFFIC_CONFLICT_RECORD_TYPES,
		});
		await this.zones.upsertDnsRecord(zoneId, {
			content: this.options.fallbackOrigin,
			name,
			proxied: false,
			type: "CNAME",
		});
	}

	private async writeValidationRecords(
		zoneId: string,
		domainName: string,
		records: readonly RequiredDomainRecord[],
	): Promise<void> {
		for (const record of mergeRequiredDomainRecords(records)) {
			await this.zones.upsertDnsRecord(zoneId, {
				content: record.value,
				name: this.fullyQualified(domainName, record.name),
				type: "TXT",
			});
		}
	}

	private async withdrawLostZone(
		row: DomainFulfillmentRow,
		dns: DomainFulfillmentDns,
		zoneId: string,
	): Promise<DomainFulfillmentRow> {
		this.logger.warn(
			`Cloudflare zone ${zoneId} for domain ${row.id} no longer exists; its nameservers are withdrawn`,
		);

		return this.state.persistApexDns(
			row,
			withdrawnCustomerZoneDnsPatch(dns, zoneId),
		);
	}

	private carriesExposedZone(
		row: DomainFulfillmentRow,
		dns: DomainFulfillmentDns,
	): boolean {
		return row.source === "external" && typeof dns.zoneId === "string";
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
