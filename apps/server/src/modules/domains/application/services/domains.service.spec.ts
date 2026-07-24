import {
	purchaseDomainBodySchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";

import {
	DomainAlreadyExistsError,
	DomainPaymentsNotConfiguredError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
} from "../../domain/ports/domain-provider.port";
import type { CustomHostnameService } from "../../infrastructure/cloudflare/custom-hostname.service";
import type { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import type {
	DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";
import { DomainsService } from "./domains.service";

const userId = "user_1";
const projectId = "11111111-1111-4111-8111-111111111111";

const validRegistrant = {
	firstName: "Zack",
	lastName: "Belaid",
	email: "zack@example.com",
	phone: "+213555123456",
	address: {
		street: "12 Rue Didouche Mourad",
		city: "Algiers",
		wilaya: "Alger",
		zip: "16000",
		countryCode: "DZ",
	},
};

class FakeDomainsRepository {
	readonly projects = new Set([`${userId}:${projectId}`]);
	readonly rows = new Map<string, DomainRow>();
	private nextId = 1;

	async assertProjectOwned(inputUserId: string, inputProjectId: string) {
		if (!this.projects.has(`${inputUserId}:${inputProjectId}`)) {
			throw new Error("Project not found");
		}
	}

	async listByProject(inputProjectId: string, inputUserId: string) {
		await this.assertProjectOwned(inputUserId, inputProjectId);

		return [...this.rows.values()].filter(
			(row) => row.projectId === inputProjectId && row.userId === inputUserId,
		);
	}

	async getByIdForUser(id: string, inputUserId: string) {
		const row = this.rows.get(id);

		if (!row || row.userId !== inputUserId) {
			throw new Error("Domain not found");
		}

		return row;
	}

	async createPurchased(input: {
		name: string;
		projectId: string;
		registrant: typeof validRegistrant;
		tld: string;
		userId: string;
	}) {
		const row = this.makeRow({
			name: input.name,
			projectId: input.projectId,
			provider: "namecom",
			registrant: input.registrant,
			source: "purchased",
			status: "registering",
			tld: input.tld,
			userId: input.userId,
		});
		this.rows.set(row.id, row);

		return row;
	}

	async createPurchasedReplacingTerminal(input: {
		name: string;
		projectId: string;
		registrant: typeof validRegistrant;
		tld: string;
		userId: string;
	}) {
		this.deleteTerminalNameOrThrow(input.name);

		return this.createPurchased(input);
	}

	async createExternal(input: {
		name: string;
		projectId: string;
		tld: string;
		userId: string;
	}) {
		const row = this.makeRow({
			autoRenew: false,
			name: input.name,
			projectId: input.projectId,
			provider: null,
			source: "external",
			status: "configuring",
			tld: input.tld,
			userId: input.userId,
			whoisPrivacy: false,
		});
		this.rows.set(row.id, row);

		return row;
	}

	async createExternalReplacingTerminal(input: {
		name: string;
		projectId: string;
		tld: string;
		userId: string;
	}) {
		this.deleteTerminalNameOrThrow(input.name);

		return this.createExternal(input);
	}

	async deleteById(id: string) {
		this.rows.delete(id);
	}

	async updateById(id: string, patch: Partial<DomainRow>) {
		const row = this.rows.get(id);

		if (!row) {
			throw new Error("Domain not found");
		}

		const updated = {
			...row,
			...patch,
			updatedAt: new Date(row.updatedAt.getTime() + 1000),
		} satisfies DomainRow;
		this.rows.set(id, updated);

		return updated;
	}

	async recordRenewalNotice(id: string, message: string) {
		return this.updateById(id, { error: message });
	}

	async setPrimary(id: string, inputUserId: string) {
		const row = await this.getByIdForUser(id, inputUserId);

		if (!row.projectId) {
			throw new Error("Detached");
		}

		for (const sibling of this.rows.values()) {
			if (
				sibling.userId === inputUserId &&
				sibling.projectId === row.projectId
			) {
				this.rows.set(sibling.id, { ...sibling, isPrimary: false });
			}
		}

		return this.updateById(id, { isPrimary: true });
	}

	async detach(id: string, inputUserId: string) {
		await this.getByIdForUser(id, inputUserId);

		return this.updateById(id, { isPrimary: false, projectId: null });
	}

	seed(
		input: Partial<DomainRow> & Pick<DomainRow, "name" | "source" | "status">,
	) {
		const row = this.makeRow(input);
		this.rows.set(row.id, row);

		return row;
	}

	private deleteTerminalNameOrThrow(name: string) {
		const existing = [...this.rows.values()].find((row) => row.name === name);

		if (!existing) {
			return;
		}

		if (existing.status !== "failed" && existing.status !== "transferred_out") {
			throw new DomainAlreadyExistsError(name);
		}

		this.rows.delete(existing.id);
	}

	private makeRow(input: Partial<DomainRow> & Pick<DomainRow, "name">) {
		const { name, ...rest } = input;
		const id = `22222222-2222-4222-8222-${String(this.nextId).padStart(12, "0")}`;
		const now = new Date(1_700_000_000_000 + this.nextId * 1000);
		this.nextId += 1;

		return {
			autoRenew: true,
			cfCustomHostnameId: null,
			createdAt: now,
			dns: null,
			error: null,
			expiresAt: null,
			id,
			isPrimary: false,
			name,
			priceSnapshot: null,
			projectId,
			provider: "namecom",
			providerDomainId: null,
			providerOrderId: null,
			providerTotalPaidUsd: null,
			registrant: null,
			source: "purchased",
			status: "registering",
			tld: "com",
			transferLockExpiresAt: null,
			updatedAt: now,
			userId,
			whoisPrivacy: true,
			...rest,
		} satisfies DomainRow;
	}
}

class FakeProvider implements DomainProvider {
	availability: DomainAvailability[] = [];
	authCode = "AUTH-SECRET";
	lockCalls: Array<{ locked: boolean; name: string }> = [];

	readonly checkAvailability = vi.fn(async (names: string[]) => {
		return names.map(
			(name) =>
				this.availability.find((item) => item.name === name) ?? {
					available: true,
					name,
					wholesalePriceUsd: 8,
				},
		);
	});

	readonly register = vi.fn(async () => {
		return {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "namecom_1",
			providerOrderId: "namecom_order_1",
			totalPaidUsd: 12.5,
			transferLockExpiresAt: new Date("2027-03-02T00:00:00.000Z"),
		};
	});

	readonly renew = vi.fn(async () => {
		return { expiresAt: new Date("2028-01-01T00:00:00.000Z") };
	});

	readonly setDnsRecords = vi.fn(
		async (_name: string, _records: DomainDnsRecord[]) => undefined,
	);

	readonly setUrlForwarding = vi.fn(
		async (_name: string, _target: string) => undefined,
	);

	readonly getAuthCode = vi.fn(async () => {
		return this.authCode;
	});

	readonly setTransferLock = vi.fn(async (name: string, locked: boolean) => {
		this.lockCalls.push({ locked, name });
	});

	readonly getDomainInfo = vi.fn(
		async (): Promise<DomainProviderInfo | null> => null,
	);
}

class FakeCustomHostnameService {
	status = "pending";
	readonly createCustomHostname = vi.fn(async () => ({
		hostnameStatus: "pending",
		id: "cf_1",
		requiredRecords: [
			{
				name: "_cf-custom-hostname.example.com",
				type: "TXT" as const,
				value: "cf-token",
			},
		],
		sslStatus: "pending_validation",
		status: "pending",
	}));
	readonly getCustomHostnameStatus = vi.fn(async () => ({
		hostnameStatus: this.status,
		id: "cf_1",
		requiredRecords: [],
		sslStatus: this.status,
		status: this.status,
	}));
	readonly deleteCustomHostname = vi.fn(async () => undefined);
}

class FakeRoutingService {
	readonly deleted: string[] = [];
	readonly pointers: Array<{ host: string; pointer: Record<string, unknown> }> =
		[];

	async putDomainPointer(host: string, pointer: Record<string, unknown>) {
		this.pointers.push({ host, pointer });
	}

	async deleteDomainPointer(host: string) {
		this.deleted.push(host);
	}

	async refreshProjectDomains() {}
}

function setQueueEnabled(enabled: boolean) {
	process.env.QUEUE_ENABLED = enabled ? "true" : "false";
}

function setup() {
	setQueueEnabled(true);
	const repository = new FakeDomainsRepository();
	const provider = new FakeProvider();
	const cloudflare = new FakeCustomHostnameService();
	const routing = new FakeRoutingService();
	const queue = {
		add: vi.fn(async () => undefined),
	};
	const logger = {
		error: vi.fn(),
		log: vi.fn(),
		warn: vi.fn(),
	};
	const service = new DomainsService(
		repository as unknown as DomainsRepository,
		provider,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		logger,
		queue as never,
	);

	return {
		cloudflare,
		logger,
		provider,
		queue,
		repository,
		routing,
		service,
	};
}

function expectNoRegistrarMutation(provider: FakeProvider) {
	expect(provider.register).not.toHaveBeenCalled();
	expect(provider.renew).not.toHaveBeenCalled();
	expect(provider.setDnsRecords).not.toHaveBeenCalled();
	expect(provider.setUrlForwarding).not.toHaveBeenCalled();
	expect(provider.setTransferLock).not.toHaveBeenCalled();
}

describe("DomainsService", () => {
	it("stops an available purchase before row, queue, or registrar mutation", async () => {
		const { provider, queue, repository, service } = setup();
		const createPurchased = vi.spyOn(
			repository,
			"createPurchasedReplacingTerminal",
		);
		const update = vi.spyOn(repository, "updateById");

		await expect(
			service.purchase(userId, projectId, {
				name: "Example.COM",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(DomainPaymentsNotConfiguredError);

		expect(provider.checkAvailability).toHaveBeenCalledWith(["example.com"]);
		expect(createPurchased).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(repository.rows.size).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("rejects premium purchases before payment or registrar mutation", async () => {
		const { provider, queue, repository, service } = setup();
		const createPurchased = vi.spyOn(
			repository,
			"createPurchasedReplacingTerminal",
		);
		provider.availability = [
			{
				available: true,
				name: "premium.com",
				premium: true,
				wholesalePriceUsd: 900,
			},
		];

		await expect(
			service.purchase(userId, projectId, {
				name: "premium.com",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(PremiumDomainBlockedError);

		expect(createPurchased).not.toHaveBeenCalled();
		expect(repository.rows.size).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("fails closed when an available registrar result omits its price", async () => {
		const { provider, queue, repository, service } = setup();
		const createPurchased = vi.spyOn(
			repository,
			"createPurchasedReplacingTerminal",
		);
		provider.availability = [
			{
				available: true,
				name: "missing-price.com",
			},
		];

		await expect(
			service.purchase(userId, projectId, {
				name: "missing-price.com",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(PremiumDomainBlockedError);

		expect(createPurchased).not.toHaveBeenCalled();
		expect(repository.rows.size).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("stops renewal before row, queue, or registrar mutation", async () => {
		const { provider, queue, repository, service } = setup();
		const row = repository.seed({
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			name: "renew.com",
			providerDomainId: "namecom_renew",
			source: "purchased",
			status: "active",
		});
		const update = vi.spyOn(repository, "updateById");

		await expect(service.renew(row.id, userId)).rejects.toBeInstanceOf(
			DomainPaymentsNotConfiguredError,
		);

		expect(update).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)).toEqual(row);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("stops auto-renew enable before row, queue, or registrar mutation", async () => {
		const { provider, queue, repository, service } = setup();
		const row = repository.seed({
			autoRenew: false,
			name: "auto-renew.com",
			providerDomainId: "namecom_auto_renew",
			source: "purchased",
			status: "active",
		});
		const update = vi.spyOn(repository, "updateById");

		await expect(
			service.setAutoRenew(row.id, userId, { autoRenew: true }),
		).rejects.toBeInstanceOf(DomainPaymentsNotConfiguredError);

		expect(update).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.autoRenew).toBe(false);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("allows disabling auto-renew without payment or registrar mutation", async () => {
		const { provider, queue, repository, service } = setup();
		const row = repository.seed({
			autoRenew: true,
			name: "disable-auto-renew.com",
			providerDomainId: "namecom_disable_auto_renew",
			source: "purchased",
			status: "active",
		});
		const update = vi.spyOn(repository, "updateById");

		await expect(
			service.setAutoRenew(row.id, userId, { autoRenew: false }),
		).resolves.toMatchObject({
			domain: { autoRenew: false, id: row.id },
		});

		expect(update).toHaveBeenCalledWith(row.id, { autoRenew: false });
		expect(repository.rows.get(row.id)?.autoRenew).toBe(false);
		expect(queue.add).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("returns Name.com USD prices only for safely purchasable domains", async () => {
		const { provider, service } = setup();
		provider.availability = [
			{
				available: true,
				name: "shop.com",
				wholesalePriceUsd: 17.99,
			},
			{
				available: true,
				name: "shop.net",
				premium: true,
				wholesalePriceUsd: 19.99,
			},
			{
				available: true,
				name: "shop.shop",
			},
			{
				available: false,
				name: "shop.store",
				wholesalePriceUsd: 72.99,
			},
		];

		const response = await service.search(userId, "shop");

		expect(response.results.slice(0, 4)).toEqual([
			{
				availability: "available",
				name: "shop.com",
				registrationPriceUsd: 17.99,
				tld: "com",
			},
			{
				availability: "premium_blocked",
				name: "shop.net",
				registrationPriceUsd: null,
				tld: "net",
			},
			{
				availability: "premium_blocked",
				name: "shop.shop",
				registrationPriceUsd: null,
				tld: "shop",
			},
			{
				availability: "unavailable",
				name: "shop.store",
				registrationPriceUsd: null,
				tld: "store",
			},
		]);
		expect(JSON.stringify(response)).not.toMatch(
			/registrationCredits|renewalCredits|wholesalePriceUsd/,
		);
	});

	it("attaches BYO domains with required records and verifies only once Cloudflare is active", async () => {
		const { cloudflare, queue, repository, routing, service } = setup();

		const attached = await service.attachExternal(userId, projectId, {
			name: "brand.com",
		});
		const row = [...repository.rows.values()][0];
		expect(row).toBeDefined();

		if (!row) {
			throw new Error("Expected BYO row");
		}

		expect(queue.add).toHaveBeenCalledWith(
			"domain-configure",
			{
				attempt: 0,
				domainId: row.id,
				nonce: String(row.updatedAt.getTime()),
			},
			expect.objectContaining({
				attempts: 3,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				jobId: `domain-configure:${row.id}:${row.updatedAt.getTime()}:0`,
			}),
		);

		expect(attached.requiredRecords).toEqual(
			expect.arrayContaining<RequiredDomainRecord>([
				expect.objectContaining({
					name: "www",
					type: "CNAME",
					value: env.DOMAINS_FALLBACK_ORIGIN,
				}),
				expect.objectContaining({
					type: "TXT",
					value: "cf-token",
				}),
			]),
		);
		expect(attached.requiredRecords).not.toEqual(
			expect.arrayContaining<RequiredDomainRecord>([
				expect.objectContaining({
					name: "@",
					type: "A",
				}),
			]),
		);

		await expect(service.verify(row.id, userId)).resolves.toMatchObject({
			domain: { status: "configuring" },
		});
		expect(routing.pointers).toHaveLength(0);

		cloudflare.status = "active";
		await expect(service.verify(row.id, userId)).resolves.toMatchObject({
			domain: { status: "active" },
		});
		expect(routing.pointers).toEqual([
			{ host: "brand.com", pointer: { projectId, source: "domain" } },
		]);
	});

	it("deletes the external row when Cloudflare hostname creation fails", async () => {
		const { cloudflare, queue, repository, service } = setup();
		cloudflare.createCustomHostname.mockRejectedValueOnce(new Error("cf down"));

		await expect(
			service.attachExternal(userId, projectId, { name: "broken.dz" }),
		).rejects.toThrow("cf down");

		expect(repository.rows.size).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).not.toHaveBeenCalled();
	});

	it("cleans up the Cloudflare hostname when BYO enqueue rollback runs", async () => {
		const { cloudflare, queue, repository, service } = setup();
		queue.add.mockRejectedValueOnce(new Error("redis down"));

		await expect(
			service.attachExternal(userId, projectId, { name: "rollback.org" }),
		).rejects.toThrow("redis down");

		expect(repository.rows.size).toBe(0);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_1");
	});

	it("sets primary transactionally and detaches without releasing the registration", async () => {
		const { cloudflare, repository, routing, service } = setup();
		const first = repository.seed({
			isPrimary: true,
			name: "first.com",
			projectId,
			providerDomainId: "namecom_first",
			source: "purchased",
			status: "active",
		});
		const second = repository.seed({
			cfCustomHostnameId: "cf_detach",
			name: "second.com",
			projectId,
			providerDomainId: "namecom_second",
			providerOrderId: "namecom_order_second",
			providerTotalPaidUsd: "12.50",
			source: "purchased",
			status: "active",
			transferLockExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
		});

		await service.setPrimary(second.id, userId);
		expect(repository.rows.get(first.id)?.isPrimary).toBe(false);
		expect(repository.rows.get(second.id)?.isPrimary).toBe(true);

		const detached = await service.detach(second.id, userId);
		expect(detached.domain.projectId).toBeNull();
		expect(detached.domain.isPrimary).toBe(false);
		expect(repository.rows.get(second.id)?.providerDomainId).toBe(
			"namecom_second",
		);
		expect(routing.deleted).toEqual(["second.com"]);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_detach");
	});

	it("transfer unlock returns the auth code without logging or storing it", async () => {
		const { logger, provider, repository, service } = setup();
		const row = repository.seed({
			name: "unlock.com",
			providerDomainId: "namecom_1",
			providerOrderId: "namecom_order_1",
			providerTotalPaidUsd: "11.25",
			source: "purchased",
			status: "active",
		});

		const response = await service.transferUnlock(row.id, userId);

		expect(response.authCode).toBe(provider.authCode);
		expect(provider.lockCalls).toEqual([{ locked: false, name: "unlock.com" }]);
		expect(JSON.stringify(repository.rows.get(row.id))).not.toContain(
			provider.authCode,
		);
		for (const fn of [logger.log, logger.warn, logger.error]) {
			expect(JSON.stringify(fn.mock.calls)).not.toContain(provider.authCode);
		}
	});

	it("rejects invalid names at the validation boundary before services run", () => {
		expect(() =>
			purchaseDomainBodySchema.parse({
				name: "wandit.app",
				registrant: validRegistrant,
			}),
		).toThrow();
		expect(() =>
			purchaseDomainBodySchema.parse({
				name: "bad_name.com",
				registrant: validRegistrant,
			}),
		).toThrow();
	});
});
