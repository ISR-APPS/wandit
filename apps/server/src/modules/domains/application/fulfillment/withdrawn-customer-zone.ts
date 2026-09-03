import type { DomainDns } from "@wandit/contracts";

import { withoutNameserverRequiredDomainRecords } from "../../domain/domain-provisioning-rules";
import type { DomainApexDnsPatch } from "./domain-fulfillment.contracts";

const APEX_ERROR_MAX_LENGTH = 240;

/**
 * Withdraws a Cloudflare zone that no longer exists (deleted out of band or
 * purged by Cloudflare) from a row: every zone and apex-pass key is removed,
 * the nameservers exposed for it leave `dns.records` so no UI recommends
 * delegating to a zone nobody hosts, and `apexError` explains it. The apex
 * hostname id is kept (the hostname still exists). A later authorized
 * configure pass can find-or-create a zone and expose fresh nameservers.
 */
export function withdrawnCustomerZoneDnsPatch(
	dns: DomainDns,
	zoneId: string,
): DomainApexDnsPatch {
	return {
		apexConfigured: null,
		apexCustomHostnameNudged: null,
		apexError: `Cloudflare zone ${zoneId} no longer exists`.slice(
			0,
			APEX_ERROR_MAX_LENGTH,
		),
		records: withoutNameserverRequiredDomainRecords(dns.records ?? []),
		zoneActive: null,
		zoneCreated: null,
		zoneDelegated: null,
		zoneId: null,
		zoneNameServers: null,
		zoneNameserversExposedAt: null,
		zoneScanRecordsAdded: null,
		zoneScanned: null,
		zoneStatus: null,
	};
}
