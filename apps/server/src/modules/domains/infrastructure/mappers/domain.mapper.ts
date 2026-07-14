import {
	type Domain,
	domainDnsSchema,
	domainPriceSnapshotSchema,
	registrantSchema,
} from "@wandit/contracts";

import type { DomainRow } from "../persistence/domains.repository";

export function mapDomain(row: DomainRow): Domain {
	const priceSnapshot = domainPriceSnapshotSchema.safeParse(row.priceSnapshot);
	const registrant = registrantSchema.safeParse(row.registrant);
	const dns = domainDnsSchema.safeParse(row.dns);

	return {
		autoRenew: row.autoRenew,
		createdAt: row.createdAt.toISOString(),
		dns: dns.success ? { records: dns.data.records ?? [] } : null,
		error: safeDomainErrorSummary(row.error),
		expiresAt: row.expiresAt?.toISOString() ?? null,
		id: row.id,
		isPrimary: row.isPrimary,
		name: row.name,
		priceSnapshot: priceSnapshot.success
			? {
					registrationCredits: priceSnapshot.data.registrationCredits,
					renewalCredits: priceSnapshot.data.renewalCredits,
					tld: priceSnapshot.data.tld,
				}
			: null,
		projectId: row.projectId,
		provider: row.provider === "openprovider" ? "openprovider" : null,
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
