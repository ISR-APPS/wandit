import { describe, expect, it, vi } from "vitest";

import {
	type DomainRegistrarInfoSource,
	type DomainRegistrarSyncCandidate,
	DomainRegistrarSyncService,
	type DomainRegistrarSyncStore,
} from "./domain-registrar-sync.service";

type RegistrarInfoEntry =
	| Awaited<ReturnType<DomainRegistrarInfoSource["getDomainInfo"]>>
	| Error;

function candidate(
	id: string,
	name: string,
	overrides: Partial<DomainRegistrarSyncCandidate> = {},
): DomainRegistrarSyncCandidate {
	return {
		id,
		name,
		provider: "namecom",
		providerDomainId: name,
		source: "purchased",
		status: "active",
		...overrides,
	};
}

function setup(input: {
	candidates?: readonly DomainRegistrarSyncCandidate[];
	infoByName?: ReadonlyMap<string, RegistrarInfoEntry>;
}) {
	const candidates = input.candidates ?? [];
	const infoByName = input.infoByName ?? new Map();
	const store = {
		findPurchasedForSync: vi.fn(async () => candidates),
		updateById: vi.fn(async () => undefined),
	} satisfies DomainRegistrarSyncStore;
	const registrar = {
		getDomainInfo: vi.fn(async (name: string) => {
			const info = infoByName.get(name);

			if (info instanceof Error) {
				throw info;
			}

			return info ?? null;
		}),
	} satisfies DomainRegistrarInfoSource;
	const logger = { warn: vi.fn() };

	return {
		logger,
		registrar,
		service: new DomainRegistrarSyncService(store, registrar, logger),
		store,
	};
}

describe("DomainRegistrarSyncService", () => {
	it("reconciles registrar expiry, transfer lock, and terminal statuses", async () => {
		const active = candidate("domain_active", "active.com");
		const expired = candidate("domain_expired", "expired.com");
		const transferred = candidate("domain_transferred", "transferred.com");
		const activeExpiry = new Date("2027-06-01T00:00:00.000Z");
		const lockDate = new Date("2026-09-22T00:00:00.000Z");
		const { service, store } = setup({
			candidates: [active, expired, transferred],
			infoByName: new Map<string, RegistrarInfoEntry>([
				[
					active.name,
					{
						expiresAt: activeExpiry,
						status: "active",
						transferLockExpiresAt: lockDate,
					},
				],
				[
					expired.name,
					{
						expiresAt: null,
						status: "client_expired",
						transferLockExpiresAt: undefined,
					},
				],
				[
					transferred.name,
					{
						expiresAt: null,
						status: "transferredAway",
						transferLockExpiresAt: null,
					},
				],
			]),
		});

		await expect(service.execute()).resolves.toEqual({
			failed: 0,
			processed: true,
			synced: 3,
		});
		expect(store.updateById).toHaveBeenNthCalledWith(1, active.id, {
			expiresAt: activeExpiry,
			transferLockExpiresAt: lockDate,
		});
		expect(store.updateById).toHaveBeenNthCalledWith(2, expired.id, {
			status: "expired",
			transferLockExpiresAt: null,
		});
		expect(store.updateById).toHaveBeenNthCalledWith(3, transferred.id, {
			status: "transferred_out",
			transferLockExpiresAt: null,
		});
	});

	it("marks a registrar-missing domain transferred out and non-primary", async () => {
		const vanished = candidate("domain_vanished", "vanished.com");
		const { service, store } = setup({ candidates: [vanished] });

		await expect(service.execute()).resolves.toEqual({
			failed: 0,
			processed: true,
			synced: 1,
		});
		expect(store.updateById).toHaveBeenCalledWith(vanished.id, {
			error: "Domain is no longer present in the registrar account",
			isPrimary: false,
			status: "transferred_out",
		});
	});

	it("uses the eligible Name.com scan so OpenProvider and incomplete rows are excluded", async () => {
		const eligible = candidate("domain_eligible", "eligible.com");
		const { registrar, service } = setup({
			candidates: [
				eligible,
				candidate("domain_openprovider", "legacy-op.com", {
					provider: "openprovider",
				}),
				candidate("domain_external", "external.com", { source: "external" }),
				candidate("domain_incomplete", "incomplete.com", {
					providerDomainId: null,
				}),
				candidate("domain_failed", "failed.com", { status: "failed" }),
				candidate("domain_transferred", "gone.com", {
					status: "transferred_out",
				}),
			],
			infoByName: new Map([
				[
					eligible.name,
					{
						expiresAt: null,
						status: "active",
						transferLockExpiresAt: null,
					},
				],
			]),
		});

		await service.execute();

		expect(registrar.getDomainInfo).toHaveBeenCalledTimes(1);
		expect(registrar.getDomainInfo).toHaveBeenCalledWith(eligible.name);
	});

	it("isolates and logs a row failure before continuing the sweep", async () => {
		const broken = candidate("domain_broken", "broken.com");
		const healthy = candidate("domain_healthy", "healthy.com");
		const healthyExpiry = new Date("2027-06-01T00:00:00.000Z");
		const { logger, service, store } = setup({
			candidates: [broken, healthy],
			infoByName: new Map<string, RegistrarInfoEntry>([
				[broken.name, new Error("registrar 500")],
				[
					healthy.name,
					{
						expiresAt: healthyExpiry,
						status: "active",
						transferLockExpiresAt: null,
					},
				],
			]),
		});

		await expect(service.execute()).resolves.toEqual({
			failed: 1,
			processed: true,
			synced: 1,
		});
		expect(store.updateById).toHaveBeenCalledWith(healthy.id, {
			expiresAt: healthyExpiry,
			transferLockExpiresAt: null,
		});
		expect(logger.warn).toHaveBeenCalledWith(
			`Domain sync failed for ${broken.id}`,
			"registrar 500",
		);
	});
});
