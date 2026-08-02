export type DomainRegistrarSyncCandidate = {
	id: string;
	name: string;
	provider: string | null;
	providerDomainId: string | null;
	source: string;
	status: string;
};

export type DomainRegistrarSyncInfo = {
	expiresAt: Date | null;
	status?: string;
	transferLockExpiresAt?: Date | null;
};

export type DomainRegistrarSyncPatch = {
	error?: string;
	expiresAt?: Date;
	isPrimary?: false;
	status?: "expired" | "transferred_out";
	transferLockExpiresAt?: Date | null;
};

export interface DomainRegistrarSyncStore {
	findPurchasedForSync(): Promise<readonly DomainRegistrarSyncCandidate[]>;
	updateById(id: string, patch: DomainRegistrarSyncPatch): Promise<unknown>;
}

export interface DomainRegistrarInfoSource {
	getDomainInfo(name: string): Promise<DomainRegistrarSyncInfo | null>;
}

export interface DomainRegistrarSyncLogger {
	warn(message: string, context?: string): void;
}

export type DomainRegistrarSyncResult = {
	failed: number;
	processed: true;
	synced: number;
};

export class DomainRegistrarSyncService {
	constructor(
		private readonly domains: DomainRegistrarSyncStore,
		private readonly registrar: DomainRegistrarInfoSource,
		private readonly logger: DomainRegistrarSyncLogger,
	) {}

	async execute(): Promise<DomainRegistrarSyncResult> {
		const candidates = await this.domains.findPurchasedForSync();
		let failed = 0;
		let synced = 0;

		for (const candidate of candidates) {
			if (
				candidate.source !== "purchased" ||
				candidate.provider !== "namecom" ||
				candidate.providerDomainId === null ||
				candidate.status === "failed" ||
				candidate.status === "transferred_out"
			) {
				continue;
			}

			try {
				const info = await this.registrar.getDomainInfo(candidate.name);

				if (!info) {
					await this.domains.updateById(candidate.id, {
						error: "Domain is no longer present in the registrar account",
						isPrimary: false,
						status: "transferred_out",
					});
					synced += 1;
					continue;
				}

				const status = this.syncedStatus(info.status);

				await this.domains.updateById(candidate.id, {
					...(info.expiresAt ? { expiresAt: info.expiresAt } : {}),
					...(status ? { status } : {}),
					transferLockExpiresAt: info.transferLockExpiresAt ?? null,
				});
				synced += 1;
			} catch (error) {
				// One bad row must not abort the weekly sweep for every other row.
				failed += 1;
				this.logger.warn(
					`Domain sync failed for ${candidate.id}`,
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		return { failed, processed: true, synced };
	}

	private syncedStatus(
		status: string | undefined,
	): DomainRegistrarSyncPatch["status"] | null {
		if (!status) {
			return null;
		}

		if (status.includes("expired")) {
			return "expired";
		}

		if (status.includes("transferred")) {
			return "transferred_out";
		}

		return null;
	}
}
