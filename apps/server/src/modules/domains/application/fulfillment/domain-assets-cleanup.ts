import type {
	DomainFulfillmentLogger,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

type DomainAssetRow = Pick<
	DomainFulfillmentRow,
	"cfCustomHostnameId" | "id" | "name" | "projectId"
>;

type DomainAssetsCleanupDependencies = {
	deleteCustomHostname(id: string): Promise<void>;
	deleteDomainPointer(name: string): Promise<void>;
	logger: DomainFulfillmentLogger;
};

export async function bestEffortDeleteCustomHostname(
	row: DomainAssetRow,
	dependencies: DomainAssetsCleanupDependencies,
): Promise<boolean> {
	if (!row.cfCustomHostnameId) {
		return false;
	}

	try {
		await dependencies.deleteCustomHostname(row.cfCustomHostnameId);
		return true;
	} catch (error) {
		dependencies.logger.warn(
			`Failed to delete Cloudflare custom hostname for domain ${row.id}`,
			error instanceof Error ? error.message : String(error),
		);
		return false;
	}
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
