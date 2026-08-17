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

export function apexCustomHostnameIdOf(dns: unknown): string | null {
	const parsed = domainDnsSchema.safeParse(dns);

	return parsed.success ? (parsed.data.apexCustomHostnameId ?? null) : null;
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
