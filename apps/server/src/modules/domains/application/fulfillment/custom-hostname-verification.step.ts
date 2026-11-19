/**
 * Reads the www custom hostname status for one probe of DomainConfigurationRunner.
 * When Cloudflare deleted the hostname, it creates the hostname again and stores the new id.
 * domain-fulfillment.runtime.ts wires it. DomainsService.verify calls recreateDeletedCustomHostname.
 */
import {
	type DomainStatus,
	domainDnsSchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";

import {
	DOMAIN_VALIDATION_RECORD_PURPOSE,
	validationRequiredDomainRecords,
} from "../../domain/domain-provisioning-rules";
import { CustomHostnameMissingError } from "../../domain/errors/domain.errors";
import type {
	CustomHostnameResult,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

export type CustomHostnameVerificationResult =
	| {
			hostnameStatus: string | null;
			sslStatus: string | null;
			status: "active" | "pending";
	  }
	| {
			hostnameStatus: string | null;
			/** The row after the write. It holds the new hostname id and validation records. */
			row: DomainFulfillmentRow;
			sslStatus: string | null;
			/** Cloudflare deleted the old hostname. The new one is pending. */
			status: "recreated";
	  }
	| { error: unknown; status: "transient" };

/** The Cloudflare calls a recreate needs. CustomHostnameService implements them. */
export type CustomHostnameRecreator = {
	deleteCustomHostname(id: string): Promise<void>;
	findOrCreateCustomHostname(host: string): Promise<CustomHostnameResult>;
};

/** Fenced row writes of DomainsRepository. Each one returns null when the row left `statuses`. */
export type CustomHostnameRowStore = {
	mergeDnsIfStatus(
		id: string,
		statuses: DomainStatus[],
		patch: { records: RequiredDomainRecord[] },
	): Promise<DomainFulfillmentRow | null>;
	updateIfStatusOrNull(
		id: string,
		statuses: DomainStatus[],
		patch: { cfCustomHostnameId: string },
	): Promise<DomainFulfillmentRow | null>;
};

type CustomHostnameStatusProvider = CustomHostnameRecreator & {
	/** Throws CustomHostnameMissingError when Cloudflare deleted the hostname. */
	getCustomHostnameStatus(id: string): Promise<CustomHostnameResult>;
};

const RECREATE_LIVE_STATUSES: DomainStatus[] = ["configuring", "active"];

export class CustomHostnameVerificationStep {
	constructor(
		private readonly provider: CustomHostnameStatusProvider,
		private readonly domains: CustomHostnameRowStore,
	) {}

	/** `id` is the stored www hostname id of `row`. A provider error becomes "transient". */
	async execute(
		id: string,
		row: DomainFulfillmentRow,
	): Promise<CustomHostnameVerificationResult> {
		try {
			const result = await this.provider.getCustomHostnameStatus(id);
			const fullyActive =
				result.hostnameStatus === "active" && result.sslStatus === "active";

			return {
				hostnameStatus: result.hostnameStatus,
				sslStatus: result.sslStatus,
				status: fullyActive ? "active" : "pending",
			};
		} catch (error) {
			if (!(error instanceof CustomHostnameMissingError)) {
				return { error, status: "transient" };
			}
		}

		try {
			const recreated = await recreateDeletedCustomHostname(
				row,
				this.provider,
				this.domains,
			);

			if (!recreated) {
				return {
					error: new Error(`Domain ${row.id} left its live status`),
					status: "transient",
				};
			}

			return {
				hostnameStatus: recreated.hostname.hostnameStatus,
				row: recreated.row,
				sslStatus: recreated.hostname.sslStatus,
				status: "recreated",
			};
		} catch (error) {
			return { error, status: "transient" };
		}
	}
}

/**
 * Creates the www hostname again after Cloudflare deleted it (it does that after 7 pending days).
 * Stores the new id, and replaces the old validation TXT records in `dns.records`.
 * Returns null when the row is no longer `configuring` or `active`.
 */
export async function recreateDeletedCustomHostname(
	row: DomainFulfillmentRow,
	customHostnames: CustomHostnameRecreator,
	domains: CustomHostnameRowStore,
): Promise<{
	hostname: CustomHostnameResult;
	row: DomainFulfillmentRow;
} | null> {
	const hostname = await customHostnames.findOrCreateCustomHostname(row.name);
	const claimed = await domains.updateIfStatusOrNull(
		row.id,
		RECREATE_LIVE_STATUSES,
		{ cfCustomHostnameId: hostname.id },
	);

	if (!claimed) {
		// No live row owns the new hostname, so no cleanup can find it later.
		await customHostnames.deleteCustomHostname(hostname.id);
		return null;
	}

	// All validation records in dns.records belong to the www hostname. The apex TXT stays in our zone.
	const dns = domainDnsSchema.safeParse(claimed.dns);
	const kept = (dns.success ? (dns.data.records ?? []) : []).filter(
		(record) => record.purpose !== DOMAIN_VALIDATION_RECORD_PURPOSE,
	);
	const updated = await domains.mergeDnsIfStatus(
		row.id,
		RECREATE_LIVE_STATUSES,
		{
			records: [
				...kept,
				...validationRequiredDomainRecords(hostname.requiredRecords),
			],
		},
	);

	return updated ? { hostname, row: updated } : null;
}
