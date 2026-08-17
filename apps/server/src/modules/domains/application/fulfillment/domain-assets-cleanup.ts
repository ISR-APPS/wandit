import { domainDnsSchema } from "@wandit/contracts";

import type {
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

type DomainAssetRow = Pick<
	DomainFulfillmentRow,
	"cfCustomHostnameId" | "dns" | "id" | "name" | "projectId"
>;

type DomainAssetsCleanupDependencies = {
	deleteCustomHostname(id: string): Promise<void>;
	deleteDomainPointer(name: string): Promise<void>;
	logger: DomainFulfillmentLogger;
};

type CustomerZoneCleanupDependencies = {
	deleteZone(id: string): Promise<void>;
	logger: DomainFulfillmentLogger;
};

/**
 * Deletes the www custom hostname (the row column) and, when a purchased
 * domain recorded one, the apex custom hostname kept in `dns`. Returns whether
 * the www hostname was deleted; the apex delete is best-effort parity only.
 */
export async function bestEffortDeleteCustomHostname(
	row: DomainAssetRow,
	dependencies: DomainAssetsCleanupDependencies,
): Promise<boolean> {
	let deleted = false;

	if (row.cfCustomHostnameId) {
		try {
			await dependencies.deleteCustomHostname(row.cfCustomHostnameId);
			deleted = true;
		} catch (error) {
			dependencies.logger.warn(
				`Failed to delete Cloudflare custom hostname for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	const apexCustomHostnameId = apexCustomHostnameIdOf(row.dns);

	if (apexCustomHostnameId) {
		try {
			await dependencies.deleteCustomHostname(apexCustomHostnameId);
		} catch (error) {
			dependencies.logger.warn(
				`Failed to delete Cloudflare apex custom hostname for domain ${row.id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	return deleted;
}

/**
 * Terminal purchase failure only. Deletes the domain's Cloudflare zone when
 * this pipeline created it AND never reached the registrar nameserver call
 * (`dns.zoneDelegated` unset — the step persists that marker BEFORE calling
 * the registrar, so a timed-out or racing call still counts as delegated):
 * such a zone carries no live delegation. An adopted zone, or one whose
 * delegation may have gone live (`zoneDelegated` or `apexConfigured` set), is
 * left in place and logged — deleting a zone that the registry still
 * delegates to would black-hole the domain's DNS. Detach/unpublish never call
 * this.
 */
export async function bestEffortDeleteCustomerZone(
	row: DomainAssetRow,
	dependencies: CustomerZoneCleanupDependencies,
): Promise<boolean> {
	const parsed = domainDnsSchema.safeParse(row.dns);
	const dns = parsed.success ? parsed.data : null;

	if (!dns?.zoneId) {
		return false;
	}

	if (
		dns.zoneCreated !== true ||
		dns.zoneDelegated === true ||
		dns.apexConfigured === true
	) {
		dependencies.logger.warn(
			`Leaving Cloudflare zone ${dns.zoneId} for domain ${row.id} in place`,
			dns.zoneCreated !== true
				? "zone was adopted, not created by fulfillment"
				: "nameservers were already delegated to the zone",
		);

		return false;
	}

	try {
		await dependencies.deleteZone(dns.zoneId);
		return true;
	} catch (error) {
		dependencies.logger.warn(
			`Failed to delete Cloudflare zone for domain ${row.id}`,
			error instanceof Error ? error.message : String(error),
		);
		return false;
	}
}

export function apexCustomHostnameIdOf(dns: unknown): string | null {
	const parsed = domainDnsSchema.safeParse(dns);

	return parsed.success ? (parsed.data.apexCustomHostnameId ?? null) : null;
}

export function customerZoneIdOf(dns: unknown): string | null {
	const parsed = domainDnsSchema.safeParse(dns);

	return parsed.success ? (parsed.data.zoneId ?? null) : null;
}

export async function bestEffortDeleteDomainPointer(
	row: DomainAssetRow,
	dependencies: DomainAssetsCleanupDependencies,
): Promise<void> {
	if (!row.projectId) {
		return;
	}

	try {
		await dependencies.deleteDomainPointer(row.name);
	} catch (error) {
		dependencies.logger.warn(
			`Failed to delete domain routing pointer for ${row.id}`,
			error instanceof Error ? error.message : String(error),
		);
	}
}
