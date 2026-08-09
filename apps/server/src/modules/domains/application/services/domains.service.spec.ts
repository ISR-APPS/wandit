import {
	DOMAIN_REGISTRATION_USD_CENTS,
	DOMAIN_TLD_CATALOG,
	domainNameSchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DomainNotAvailableError,
	DomainsUnavailableError,
	InvalidDomainStateError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
} from "../../domain/ports/domain-provider.port";
import type { DomainTaskDispatcher } from "../../domain/ports/domain-task-dispatcher.port";
import type { CustomHostnameService } from "../../infrastructure/cloudflare/custom-hostname.service";
import type { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import type {
	DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { DomainsService } from "./domains.service";

const userId = "user_1";
const projectId = "11111111-1111-4111-8111-111111111111";
const scope: ProjectScope = { kind: "personal", userId };

class FakeDomainsRepository {
	readonly projects = new Set([`${userId}:${projectId}`]);
	readonly rows = new Map<string, DomainRow>();
	private nextId = 1;

	async assertProjectAccessible(
		inputScope: ProjectScope,
		inputProjectId: string,
	) {
		if (!this.projects.has(`${inputScope.userId}:${inputProjectId}`)) {
			throw new Error("Project not found");
		}
	}

	async listByProject(inputProjectId: string, inputScope: ProjectScope) {
		await this.assertProjectAccessible(inputScope, inputProjectId);

		return [...this.rows.values()].filter(
			(row) =>
				row.projectId === inputProjectId && row.userId === inputScope.userId,
		);
	}

	async getByIdForUser(id: string, inputUserId: string) {
		const row = this.rows.get(id);

		if (!row || row.userId !== inputUserId) {
			throw new Error("Domain not found");
		}

		return row;
	}

	async getByIdForScope(id: string, inputScope: ProjectScope) {
		return this.getByIdForUser(id, inputScope.userId);
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

	async updateIfStatusOrNull(
		id: string,
		statuses: DomainRow["status"][],
		patch: Partial<DomainRow>,
	) {
		const row = this.rows.get(id);

		if (!row || !statuses.includes(row.status)) {
			return null;
		}

		return this.updateById(id, patch);
	}

	async setPrimary(id: string, inputScope: ProjectScope) {
		const row = await this.getByIdForScope(id, inputScope);

		if (!row.projectId) {
			throw new Error("Detached");
		}

		for (const sibling of this.rows.values()) {
			if (sibling.projectId === row.projectId) {
				this.rows.set(sibling.id, { ...sibling, isPrimary: false });
			}
		}

		return this.updateById(id, { isPrimary: true });
	}

	async detach(id: string, inputScope: ProjectScope) {
		await this.getByIdForScope(id, inputScope);

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
			throw new Error(`${name} already connected`);
		}

		this.rows.delete(existing.id);
	}

	private makeRow(input: Partial<DomainRow> & Pick<DomainRow, "name">) {
		const { name, ...rest } = input;
		const id = `22222222-2222-4222-8222-${String(this.nextId).padStart(12, "0")}`;
		const now = new Date(1_700_000_000_000 + this.nextId * 1000);
		this.nextId += 1;

		return {
			autoRenew: false,
			cfCustomHostnameId: null,
			createdAt: now,
			dns: null,
			error: null,
			expiresAt: null,
			id,
			isPrimary: false,
			name,
			paymentOrderId: null,
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
			whoisPrivacy: false,
			...rest,
		} satisfies DomainRow;
	}
}

class FakeProvider implements DomainProvider {
	availability: DomainAvailability[] = [];
	authCode = "AUTH-SECRET";
	info: DomainProviderInfo | null = null;
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
			providerDomainId: "example.com",
		};
	});

	readonly renew = vi.fn(async () => {
		return { expiresAt: new Date("2028-01-01T00:00:00.000Z") };
	});

	readonly setDnsRecords = vi.fn(
		async (_name: string, _records: DomainDnsRecord[]) => undefined,
	);

	readonly setUrlForwarding = vi.fn(async () => undefined);

	async getAuthCode() {
		return this.authCode;
	}

	async setTransferLock(name: string, locked: boolean) {
		this.lockCalls.push({ locked, name });
	}

	async getDomainInfo(): Promise<DomainProviderInfo | null> {
		return this.info;
	}
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

class FakeDomainTaskDispatcher implements DomainTaskDispatcher {
	readonly assertAvailable = vi.fn(() => {
		if (!process.env.TRIGGER_SECRET_KEY?.trim()) {
			throw new DomainsUnavailableError();
		}
	});

	readonly recoverPurchase = vi.fn(
		async (_payload: { domainId: string; orderId: string }) => ({
			id: "run_recovered",
		}),
	);

	readonly triggerConfiguration = vi.fn(
		async (_payload: { domainId: string; nonce: string }) => ({
			id: "run_configuration",
		}),
	);

	readonly triggerPurchase = vi.fn(
		async (_payload: { domainId: string; orderId: string }) => ({
			id: "run_purchase",
		}),
	);
}

function expectNoRegistrarMutation(provider: FakeProvider) {
	expect(provider.register).not.toHaveBeenCalled();
	expect(provider.renew).not.toHaveBeenCalled();
	expect(provider.setDnsRecords).not.toHaveBeenCalled();
	expect(provider.setUrlForwarding).not.toHaveBeenCalled();
	expect(provider.lockCalls).toHaveLength(0);
}

function setup() {
	vi.stubEnv("TRIGGER_SECRET_KEY", "tr_dev_test");
	const repository = new FakeDomainsRepository();
	const provider = new FakeProvider();
	const cloudflare = new FakeCustomHostnameService();
	const routing = new FakeRoutingService();
	const dispatcher = new FakeDomainTaskDispatcher();
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
		dispatcher,
	);

	return {
		cloudflare,
		dispatcher,
		logger,
		provider,
		repository,
		routing,
		service,
	};
}

describe("DomainsService", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns retail USD prices only for safely purchasable domains", async () => {
		const { provider, service } = setup();
		provider.availability = [
			{
				available: true,
				name: "shop.com",
				wholesalePriceUsd: 9,
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
				registrationPriceUsd: DOMAIN_REGISTRATION_USD_CENTS.com / 100,
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
		// The wire shape never carries the registrar's wholesale quote.
		expect(JSON.stringify(response)).not.toMatch(
			/registrationCredits|renewalCredits|wholesalePriceUsd/,
		);
	});

	it("blocks an over-ceiling wholesale quote from being shown as available", async () => {
		const { provider, service } = setup();
		provider.availability = [
			{
				available: true,
				name: "spike.com",
				wholesalePriceUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd + 0.01,
			},
		];

		const response = await service.search(userId, "spike.com");

		expect(response.results[0]).toMatchObject({
			availability: "premium_blocked",
			registrationPriceUsd: null,
		});
	});

	it("prepares a purchase with the validated wholesale quote and ceiling", async () => {
		const { dispatcher, provider, repository, service } = setup();
		vi.stubEnv("QUEUE_ENABLED", "false");
		const assertProjectAccessible = vi.spyOn(repository, "assertProjectAccessible");

		const prepared = await service.preparePurchase(
			scope,
			"Example.COM",
			projectId,
		);

		expect(prepared).toEqual({
			name: "example.com",
			quotedWholesaleUsd: 8,
			tld: "com",
			wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
		});
		expect(dispatcher.assertAvailable).toHaveBeenCalledOnce();
		expect(provider.checkAvailability).toHaveBeenCalledWith(["example.com"]);
		expect(assertProjectAccessible.mock.invocationCallOrder[0]).toBeLessThan(
			dispatcher.assertAvailable.mock.invocationCallOrder[0] ?? 0,
		);
		expect(dispatcher.assertAvailable.mock.invocationCallOrder[0]).toBeLessThan(
			provider.checkAvailability.mock.invocationCallOrder[0] ?? 0,
		);
		expectNoRegistrarMutation(provider);
	});

	it("keeps the existing 503 contract before the registrar when Trigger is unavailable", async () => {
		const { dispatcher, provider, repository, service } = setup();
		vi.stubEnv("TRIGGER_SECRET_KEY", "   ");
		const assertProjectAccessible = vi.spyOn(repository, "assertProjectAccessible");

		const error = await service
			.preparePurchase(scope, "example.com", projectId)
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(DomainsUnavailableError);
		expect(error).toMatchObject({
			response: {
				code: "DOMAINS_TEMPORARILY_UNAVAILABLE",
				message: "Custom domains are temporarily unavailable",
			},
			status: 503,
		});
		expect(assertProjectAccessible).toHaveBeenCalledWith(scope, projectId);
		expect(dispatcher.assertAvailable).toHaveBeenCalledOnce();
		expect(assertProjectAccessible.mock.invocationCallOrder[0]).toBeLessThan(
			dispatcher.assertAvailable.mock.invocationCallOrder[0] ?? 0,
		);
		expect(provider.checkAvailability).not.toHaveBeenCalled();
	});

	it("rejects preparing an unavailable domain", async () => {
		const { provider, service } = setup();
		provider.availability = [
			{ available: false, name: "taken.com", wholesalePriceUsd: 9 },
		];

		await expect(
			service.preparePurchase(scope, "taken.com", projectId),
		).rejects.toBeInstanceOf(DomainNotAvailableError);
	});

	it.each([
		["premium", { available: true, premium: true, wholesalePriceUsd: 9 }],
		["missing-price", { available: true }],
		["non-finite-price", { available: true, wholesalePriceUsd: Number.NaN }],
		["zero-price", { available: true, wholesalePriceUsd: 0 }],
		[
			"over-ceiling",
			{
				available: true,
				wholesalePriceUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd + 1,
			},
		],
	] as const)("fails closed when the registrar quote is unsafe (%s)", async (_label, availability) => {
		const { provider, service } = setup();
		provider.availability = [{ ...availability, name: "unsafe.com" }];

		await expect(
			service.preparePurchase(scope, "unsafe.com", projectId),
		).rejects.toBeInstanceOf(PremiumDomainBlockedError);
	});

	it("asserts project ownership before preparing a project-scoped purchase", async () => {
		const { dispatcher, provider, service } = setup();

		await expect(
			service.preparePurchase(
				scope,
				"example.com",
				"99999999-9999-4999-8999-999999999999",
			),
		).rejects.toThrow("Project not found");
		expect(dispatcher.assertAvailable).not.toHaveBeenCalled();
		expect(provider.checkAvailability).not.toHaveBeenCalled();
	});

	it("rejects enabling auto-renew while paid renewals are unavailable", async () => {
		const { dispatcher, provider, repository, service } = setup();
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
		).rejects.toBeInstanceOf(InvalidDomainStateError);

		expect(update).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.autoRenew).toBe(false);
		expect(dispatcher.triggerConfiguration).not.toHaveBeenCalled();
		expect(dispatcher.triggerPurchase).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("allows disabling auto-renew without payment or registrar mutation", async () => {
		const { dispatcher, provider, repository, service } = setup();
		const row = repository.seed({
			autoRenew: true,
			name: "disable-auto-renew.com",
			providerDomainId: "namecom_disable_auto_renew",
			source: "purchased",
			status: "active",
		});

		await expect(
			service.setAutoRenew(row.id, userId, { autoRenew: false }),
		).resolves.toMatchObject({
			domain: { autoRenew: false, id: row.id },
		});

		expect(repository.rows.get(row.id)?.autoRenew).toBe(false);
		expect(dispatcher.triggerConfiguration).not.toHaveBeenCalled();
		expect(dispatcher.triggerPurchase).not.toHaveBeenCalled();
		expectNoRegistrarMutation(provider);
	});

	it("attaches BYO domains with required records and verifies only once Cloudflare is active", async () => {
		const { cloudflare, dispatcher, repository, routing, service } = setup();

		const attached = await service.attachExternal(scope, projectId, {
			name: "brand.com",
		});
		const row = [...repository.rows.values()][0];
		expect(row).toBeDefined();

		if (!row) {
			throw new Error("Expected BYO row");
		}

		expect(dispatcher.triggerConfiguration).toHaveBeenNthCalledWith(1, {
			domainId: row.id,
			nonce: String(row.updatedAt.getTime()),
		});

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

		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: { status: "configuring" },
		});
		expect(routing.pointers).toHaveLength(0);
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledTimes(2);
		const firstManualPayload =
			dispatcher.triggerConfiguration.mock.calls[1]?.[0];
		expect(firstManualPayload).toEqual({
			domainId: row.id,
			nonce: expect.stringMatching(
				/^manual:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			),
		});

		await service.verify(row.id, scope);
		const secondManualPayload =
			dispatcher.triggerConfiguration.mock.calls[2]?.[0];
		expect(secondManualPayload?.nonce).toMatch(/^manual:/);
		expect(secondManualPayload?.nonce).not.toBe(firstManualPayload?.nonce);

		cloudflare.status = "active";
		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: { status: "active" },
		});
		expect(routing.pointers).toEqual([
			{ host: "brand.com", pointer: { projectId, source: "domain" } },
		]);
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledTimes(3);
	});

	it("deletes the external row when Cloudflare hostname creation fails", async () => {
		const { cloudflare, dispatcher, repository, service } = setup();
		cloudflare.createCustomHostname.mockRejectedValueOnce(new Error("cf down"));

		await expect(
			service.attachExternal(scope, projectId, { name: "broken.dz" }),
		).rejects.toThrow("cf down");

		expect(repository.rows.size).toBe(0);
		expect(dispatcher.triggerConfiguration).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).not.toHaveBeenCalled();
	});

	it("never reactivates a failed domain through manual verification", async () => {
		const { cloudflare, repository, routing, service } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_failed",
			name: "failed-money.com",
			source: "purchased",
			status: "failed",
		});
		cloudflare.status = "active";

		await expect(service.verify(row.id, scope)).rejects.toThrow(
			"Only configuring domains can be verified",
		);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(routing.pointers).toHaveLength(0);
		expect(cloudflare.getCustomHostnameStatus).not.toHaveBeenCalled();
	});

	it("cleans up the Cloudflare hostname and row when BYO Trigger handoff is rejected", async () => {
		const { cloudflare, dispatcher, repository, service } = setup();
		dispatcher.triggerConfiguration.mockRejectedValueOnce(
			new Error("trigger down"),
		);

		await expect(
			service.attachExternal(scope, projectId, { name: "rollback.org" }),
		).rejects.toThrow("trigger down");

		expect(repository.rows.size).toBe(0);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_1");
	});

	it("sets primary transactionally and detaches without releasing the registration", async () => {
		const { cloudflare, repository, routing, service } = setup();
		const first = repository.seed({
			isPrimary: true,
			name: "first.com",
			projectId,
			source: "purchased",
			status: "active",
		});
		const second = repository.seed({
			cfCustomHostnameId: "cf_detach",
			name: "second.com",
			projectId,
			source: "purchased",
			status: "active",
		});

		await service.setPrimary(second.id, scope);
		expect(repository.rows.get(first.id)?.isPrimary).toBe(false);
		expect(repository.rows.get(second.id)?.isPrimary).toBe(true);

		const detached = await service.detach(second.id, scope);
		expect(detached.domain.projectId).toBeNull();
		expect(detached.domain.isPrimary).toBe(false);
		expect(repository.rows.get(second.id)?.providerDomainId).toBeNull();
		expect(routing.deleted).toEqual(["second.com"]);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_detach");
	});

	it("transfer unlock returns the auth code without logging or storing it", async () => {
		const { logger, provider, repository, service } = setup();
		const row = repository.seed({
			name: "unlock.com",
			provider: "namecom",
			providerDomainId: "unlock.com",
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

	it("prefers the registrar's transfer-lock expiry over local fallbacks", async () => {
		const { provider, repository, service } = setup();
		const registrarLock = new Date("2026-09-22T00:00:00.000Z");
		provider.info = {
			expiresAt: new Date("2027-07-24T00:00:00.000Z"),
			id: "unlock-lock.com",
			transferLockExpiresAt: registrarLock,
		};
		const row = repository.seed({
			name: "unlock-lock.com",
			provider: "namecom",
			providerDomainId: "unlock-lock.com",
			source: "purchased",
			status: "active",
			transferLockExpiresAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		const response = await service.transferUnlock(row.id, userId);

		expect(response.lockedUntil).toBe(registrarLock.toISOString());
	});

	it("rejects transfer unlock for legacy openprovider rows", async () => {
		const { provider, repository, service } = setup();
		const row = repository.seed({
			name: "legacy.com",
			provider: "openprovider",
			providerDomainId: "op_1",
			source: "purchased",
			status: "active",
		});

		await expect(service.transferUnlock(row.id, userId)).rejects.toBeInstanceOf(
			InvalidDomainStateError,
		);
		expect(provider.lockCalls).toHaveLength(0);
	});

	it("rejects invalid names at the validation boundary before services run", () => {
		expect(() => domainNameSchema.parse("wandit.app")).toThrow();
		expect(() => domainNameSchema.parse("bad_name.com")).toThrow();
	});
});
