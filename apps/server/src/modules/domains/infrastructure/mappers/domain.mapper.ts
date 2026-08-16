import {
	type Domain,
	domainDnsSchema,
	registrantSchema,
} from "@wandit/contracts";

import type { DomainRow } from "../persistence/domains.repository";

export function mapDomain(row: DomainRow): Domain {
	const registrant = registrantSchema.safeParse(row.registrant);
	const dns = domainDnsSchema.safeParse(row.dns);

	return {
		autoRenew: row.autoRenew,
		createdAt: row.createdAt.toISOString(),
		dns: dns.success
			? {
					...(dns.data.externalVerification
						? { externalVerification: dns.data.externalVerification }
						: {}),
					records: dns.data.records ?? [],
				}
			: null,
		error: safeDomainErrorSummary(row.error),
		expiresAt: row.expiresAt?.toISOString() ?? null,
		id: row.id,
		isPrimary: row.isPrimary,
		name: row.name,
		projectId: row.projectId,
		provider:
			row.provider === "namecom" || row.provider === "openprovider"
				? row.provider
				: null,
		registrant: registrant.success ? registrant.data : null,
		source: row.source,
		status: row.status,
		tld: row.tld,
		updatedAt: row.updatedAt.toISOString(),
		userId: row.userId,
		whoisPrivacy: row.whoisPrivacy,
	};
}

export function safeDomainErrorSummary(error: string | null): string | null {
	if (!error) {
		return null;
	}

	return error.replace(/\s+/g, " ").slice(0, 180);
}
