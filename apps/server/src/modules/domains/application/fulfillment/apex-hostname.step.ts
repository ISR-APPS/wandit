import { domainDnsSchema } from "@wandit/contracts";

import {
	apexAnameTrafficRecord,
	mergeRequiredDomainRecords,
	validationRequiredDomainRecords,
} from "../../domain/domain-provisioning-rules";
import type { DomainDnsRecord } from "../../domain/ports/domain-provider.port";
import type {
	CustomHostnameResult,
	DomainApexDnsPatch,
	DomainFulfillmentDns,
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

const APEX_ERROR_MAX_LENGTH = 240;

type ApexCustomHostnameProvider = {
	createApexCustomHostname(host: string): Promise<CustomHostnameResult>;
	deleteCustomHostname(id: string): Promise<void>;
	findCustomHostnameByName(
		hostname: string,
	): Promise<CustomHostnameResult | null>;
	getCustomHostnameStatus(id: string): Promise<CustomHostnameResult>;
};

type ApexDnsProvider = {
	clearUrlForwarding(name: string): Promise<void>;
	setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void>;
};

/**
 * Persists only the apex-owned `dns` keys as a shallow merge into the stored
 * `dns` object, fenced on a live status, and returns the fresh row. It must
 * throw when the fence loses so the step can record (or drop) the outcome.
 */
type ApexHostnameState = {
	persistApexDns(
		row: DomainFulfillmentRow,
		patch: DomainApexDnsPatch,
	): Promise<DomainFulfillmentRow>;
};

/**
 * Everything apex for a PURCHASED domain: a bare-name Cloudflare custom
 * hostname (so `https://{domain}` has a certificate), an apex ANAME to the
 * fallback origin at the registrar, and removal of the registrar's TLS-less
 * URL forwarding. The edge then redirects apex → www.
 *
 * Best-effort contract: this step never throws. Any failure is logged, kept in
 * `dns.apexError`, and the latest row is returned, so the www path
 * (registration → www DNS → www hostname → verification → activation) is never
 * failed or delayed by an apex hiccup. `dns.apexConfigured` is the durable done
 * marker. Automatic retries: the purchase pipeline runs the step once while the
 * row is `registering` and then again on every verification probe of
 * DomainConfigurationRunner while the row is `configuring`. A row that reaches
 * `active` without the marker is only retried by `domains:backfill-apex`.
 */
export class ApexHostnameStep {
	constructor(
		private readonly customHostnames: ApexCustomHostnameProvider,
		private readonly dnsProvider: ApexDnsProvider,
		private readonly state: ApexHostnameState,
		private readonly logger: DomainFulfillmentLogger,
		private readonly fallbackOrigin: string,
	) {}

	async execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow> {
		if (row.source !== "purchased") {
			return row;
		}

		let dns = this.dnsState(row);

		if (dns.apexConfigured) {
			return row;
		}

		let current = row;

		try {
			let hostname: CustomHostnameResult;

			if (dns.apexCustomHostnameId) {
				hostname = await this.customHostnames.getCustomHostnameStatus(
					dns.apexCustomHostnameId,
				);
			} else {
				// Look up by name first so a retry adopts the hostname an earlier
				// pass created instead of tripping Cloudflare's duplicate error.
				const adopted = await this.customHostnames.findCustomHostnameByName(
					current.name,
				);
				hostname =
					adopted ??
					(await this.customHostnames.createApexCustomHostname(current.name));

				try {
					current = await this.state.persistApexDns(current, {
						apexCustomHostnameId: hostname.id,
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

			const trafficRecord = apexAnameTrafficRecord(this.fallbackOrigin);
			const validationRecords = validationRequiredDomainRecords(
				hostname.requiredRecords,
			);

			// The ANAME replaces the registrar's forwarding A record; only then is
			// the forwarding entry itself removed.
			await this.dnsProvider.setDnsRecords(
				current.name,
				[trafficRecord, ...validationRecords].map((record) => ({
					name: record.name,
					type: record.type,
					value: record.value,
				})),
			);
			await this.dnsProvider.clearUrlForwarding(current.name);

			return await this.state.persistApexDns(current, {
				apexConfigured: true,
				apexError: null,
				records: mergeRequiredDomainRecords(
					dns.records ?? [],
					validationRecords,
					[trafficRecord],
				),
			});
		} catch (error) {
			return this.recordApexError(current, error);
		}
	}

	private async recordApexError(
		row: DomainFulfillmentRow,
		error: unknown,
	): Promise<DomainFulfillmentRow> {
		const message = error instanceof Error ? error.message : String(error);

		this.logger.warn(
			`Apex hostname configuration deferred for domain ${row.id}`,
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

	private dnsState(row: DomainFulfillmentRow): DomainFulfillmentDns {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
	}
}
