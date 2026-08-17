import { domainDnsSchema } from "@wandit/contracts";

import { wwwCnameTrafficRecord } from "../../domain/domain-provisioning-rules";
import type { DomainDnsRecord } from "../../domain/ports/domain-provider.port";
import type {
	DomainFulfillmentDns,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

type PurchasedDomainDnsProvider = {
	setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void>;
};

type PurchasedDomainDnsState = {
	updatePostRegistrationState(
		row: DomainFulfillmentRow,
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow>;
};

export class PurchasedDomainDnsStep {
	constructor(
		private readonly provider: PurchasedDomainDnsProvider,
		private readonly state: PurchasedDomainDnsState,
		private readonly fallbackOrigin: string,
	) {}

	async execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow> {
		const dns = this.dnsState(row);

		if (dns.purchaseDnsConfigured) {
			return row;
		}

		const trafficRecord = wwwCnameTrafficRecord(this.fallbackOrigin);

		// The apex (ANAME + Cloudflare apex hostname) is owned by ApexHostnameStep,
		// which runs best-effort after the www hostname; this step stays on the
		// critical path and only manages the canonical www CNAME.
		await this.provider.setDnsRecords(row.name, [
			{
				name: trafficRecord.name,
				type: trafficRecord.type,
				value: trafficRecord.value,
			},
		]);

		return this.state.updatePostRegistrationState(row, {
			dns: {
				...dns,
				purchaseDnsConfigured: true,
				records: [...(dns.records ?? []), trafficRecord],
			},
		});
	}

	private dnsState(row: DomainFulfillmentRow): DomainFulfillmentDns {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
	}
}
