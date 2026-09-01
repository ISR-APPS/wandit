import {
	DOMAIN_TLD_CATALOG,
	type DomainDns,
	domainDnsSchema,
	domainNameSchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	DomainNotAvailableError,
	DomainsUnavailableError,
	ExternalDomainUnregisteredError,
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
import type { CustomerZoneService } from "../../infrastructure/cloudflare/customer-zone.service";
import type { DomainRoutingService } from "../../infrastructure/cloudflare/domain-routing.service";
import type {
	DomainRegistrationCheckResult,
	DomainRegistrationCheckService,
} from "../../infrastructure/dns/domain-registration-check.service";
import type {
	DomainRow,
	DomainsRepository,
} from "../../infrastructure/persistence/domains.repository";
import { DomainsService } from "./domains.service";

vi.mock("@wandit/env/server", () => ({
	env: { DOMAINS_FALLBACK_ORIGIN: "customers.wandit.app" },
}));

const userId = "user_1";
const projectId = "11111111-1111-4111-8111-111111111111";
const scope: ProjectScope = { kind: "personal", userId };
const zoneNameServers = ["art.ns.cloudflare.com", "savanna.ns.cloudflare.com"];
const nameserverRecords = zoneNameServers.map((value) => ({
	name: "@",
	purpose: "nameserver",
	type: "NS" as const,
	value,
})) satisfies RequiredDomainRecord[];

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

	async setDns(id: string, dns: DomainDns) {
		return this.updateById(id, { dns });
	}

	/** Mirrors the SQL merge: shallow merge into dns, `null` removes the key. */
	async mergeDnsIfStatus(
		id: string,
		statuses: DomainRow["status"][],
		patch: Record<string, unknown>,
	) {
		const row = this.rows.get(id);

		if (!row || !statuses.includes(row.status)) {
			return null;
		}

		const dns = domainDnsSchema.safeParse(row.dns);
		const merged: Record<string, unknown> = dns.success ? { ...dns.data } : {};

		for (const [key, value] of Object.entries(patch)) {
			if (value === null) {
				delete merged[key];
			} else if (value !== undefined) {
				merged[key] = value;
			}
		}

		// Cursor-only semantics: updatedAt is left alone by the SQL merge.
		const updated = { ...row, dns: merged } satisfies DomainRow;
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

	async activateAndClearExternalVerification(
		id: string,
		statuses: Extract<DomainRow["status"], "active" | "configuring">[],
	) {
		const row = this.rows.get(id);

		if (
			row?.source !== "external" ||
			!statuses.includes(row.status as "active" | "configuring")
		) {
			return null;
		}

		const dns = domainDnsSchema.safeParse(row.dns);
		const currentDns = dns.success ? dns.data : {};
		const { externalVerification: _externalVerification, ...remaining } =
			currentDns;

		return this.updateById(id, {
			dns: remaining,
			error: null,
			status: "active",
		});
	}

	async readCursor(id: string) {
		const row = this.rows.get(id);
		const dns = domainDnsSchema.safeParse(row?.dns);
		const cursor =
			dns?.success &&
			typeof dns.data.triggerConfiguration === "object" &&
			dns.data.triggerConfiguration !== null
				? (dns.data.triggerConfiguration as {
						nextAttempt?: unknown;
						nextProbeAt?: unknown;
						nonce?: unknown;
					})
				: null;

		if (
			!cursor ||
			typeof cursor.nextAttempt !== "number" ||
			typeof cursor.nonce !== "string"
		) {
			return null;
		}

		return {
			nextAttempt: cursor.nextAttempt,
			nextProbeAt:
				typeof cursor.nextProbeAt === "string"
					? new Date(cursor.nextProbeAt)
					: null,
			nonce: cursor.nonce,
		};
	}

	async prepareExternalVerificationRestart(
		id: string,
		input?: { expectedNonce: string | null; nonce: string },
	) {
		const row = this.rows.get(id);
		const dns = domainDnsSchema.safeParse(row?.dns);
		const cursor = await this.readCursor(id);
		const currentDns = dns.success ? dns.data : {};

		if (input) {
			if (
				row?.source !== "external" ||
				row.status !== "configuring" ||
				(cursor?.nonce ?? null) !== input.expectedNonce
			) {
				return null;
			}

			const restarted = {
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: input.nonce,
			};
			this.rows.set(id, {
				...row,
				dns: {
					...currentDns,
					triggerConfiguration: restarted,
				},
			});

			return restarted;
		}

		if (
			row?.source !== "external" ||
			row.status !== "configuring" ||
			!dns.success ||
			!dns.data.externalVerification ||
			!cursor
		) {
			return null;
		}

		const nonce = `manual-restart:${dns.data.externalVerification.stalledAt}`;

		if (cursor.nonce !== nonce) {
			this.rows.set(id, {
				...row,
				dns: {
					...dns.data,
					triggerConfiguration: {
						nextAttempt: 0,
						nextProbeAt: null,
						nonce,
					},
				},
			});
		}

		return {
			...dns.data.externalVerification,
			nonce,
		};
	}

	async clearExternalVerificationMarker(id: string, stalledAt: string) {
		const row = this.rows.get(id);
		const dns = domainDnsSchema.safeParse(row?.dns);

		if (
			row?.source !== "external" ||
			!dns.success ||
			dns.data.externalVerification?.stalledAt !== stalledAt
		) {
			return false;
		}

		const { externalVerification: _externalVerification, ...remaining } =
			dns.data;
		this.rows.set(id, { ...row, dns: remaining });

		return true;
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
			externalDelegationReminderSentAt: null,
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

	readonly setNameservers = vi.fn(
		async (_name: string, _nameservers: string[]) => undefined,
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
	requiredRecords: Array<{ name: string; type: "TXT"; value: string }> = [];
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
		requiredRecords: this.requiredRecords,
		sslStatus: this.status,
		status: this.status,
	}));
	readonly deleteCustomHostname = vi.fn(async () => undefined);
}

class FakeCustomerZoneService {
	existingZone: { id: string; nameServers: string[]; status: string } | null =
		null;
	/** `null` mirrors a zone that no longer exists in Cloudflare. */
	zoneStatus: string | null = "pending";
	readonly findZoneByName = vi.fn(async (_name: string) => this.existingZone);
	readonly getZoneStatus = vi.fn(async (_id: string) => this.zoneStatus);
	readonly createZone = vi.fn(async (_name: string) => ({
		id: "zone_new",
		nameServers: zoneNameServers,
		status: "pending",
	}));
	readonly deleteZone = vi.fn(async (_id: string) => undefined);
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

class FakeDomainRegistrationCheckService {
	result: DomainRegistrationCheckResult = { status: "registered" };
	readonly check = vi.fn(
		async (_name: string): Promise<DomainRegistrationCheckResult> =>
			this.result,
	);
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

	readonly recoverConfiguration = vi.fn(
		async (_payload: { domainId: string; nonce: string }) => ({
			id: "run_recovered_configuration",
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
	expect(provider.setNameservers).not.toHaveBeenCalled();
	expect(provider.setUrlForwarding).not.toHaveBeenCalled();
	expect(provider.lockCalls).toHaveLength(0);
}

function setup() {
	vi.stubEnv("TRIGGER_SECRET_KEY", "tr_dev_test");
	const repository = new FakeDomainsRepository();
	const provider = new FakeProvider();
	const cloudflare = new FakeCustomHostnameService();
	const zones = new FakeCustomerZoneService();
	const registration = new FakeDomainRegistrationCheckService();
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
		zones as unknown as CustomerZoneService,
		registration as unknown as DomainRegistrationCheckService,
		routing as unknown as DomainRoutingService,
		logger,
		dispatcher,
	);

	return {
		cloudflare,
		dispatcher,
		logger,
		provider,
		registration,
		repository,
		routing,
		service,
		zones,
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
				registrationPriceUsd: 11,
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
		const assertProjectAccessible = vi.spyOn(
			repository,
			"assertProjectAccessible",
		);

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
		const assertProjectAccessible = vi.spyOn(
			repository,
			"assertProjectAccessible",
		);

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

	it("refuses a confirmed unregistered external domain before creating resources", async () => {
		const { cloudflare, dispatcher, registration, repository, service, zones } =
			setup();
		registration.result = { status: "unregistered" };
		const assertProjectAccessible = vi.spyOn(
			repository,
			"assertProjectAccessible",
		);
		const createExternal = vi.spyOn(
			repository,
			"createExternalReplacingTerminal",
		);

		const error = await service
			.attachExternal(scope, projectId, { name: "unregistered.com" })
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ExternalDomainUnregisteredError);
		expect(error).toMatchObject({
			response: {
				code: "EXTERNAL_DOMAIN_UNREGISTERED",
				message: "unregistered.com is not registered",
			},
			status: 422,
		});
		expect(assertProjectAccessible).toHaveBeenCalledWith(scope, projectId);
		expect(registration.check).toHaveBeenCalledExactlyOnceWith(
			"unregistered.com",
		);
		expect(assertProjectAccessible.mock.invocationCallOrder[0]).toBeLessThan(
			registration.check.mock.invocationCallOrder[0] ?? 0,
		);
		expect(createExternal).not.toHaveBeenCalled();
		expect(repository.rows.size).toBe(0);
		expect(cloudflare.createCustomHostname).not.toHaveBeenCalled();
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
		expect(dispatcher.triggerConfiguration).not.toHaveBeenCalled();
	});

	it("continues an external attach when registration is inconclusive", async () => {
		const { cloudflare, registration, repository, service, zones } = setup();
		registration.result = {
			reason: "DNS registration lookup was inconclusive",
			status: "inconclusive",
		};

		await expect(
			service.attachExternal(scope, projectId, { name: "uncertain.org" }),
		).resolves.toMatchObject({ domain: { name: "uncertain.org" } });

		expect(registration.check).toHaveBeenCalledExactlyOnceWith("uncertain.org");
		expect(repository.rows.size).toBe(1);
		expect(cloudflare.createCustomHostname).toHaveBeenCalledOnce();
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
	});

	it("attaches BYO domains, reuses pending verification, and freshly restarts an active probe", async () => {
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
		expect(dispatcher.triggerConfiguration).toHaveBeenNthCalledWith(2, {
			domainId: row.id,
			nonce: String(row.updatedAt.getTime()),
		});

		await service.verify(row.id, scope);
		expect(dispatcher.triggerConfiguration).toHaveBeenNthCalledWith(3, {
			domainId: row.id,
			nonce: String(row.updatedAt.getTime()),
		});

		cloudflare.status = "active";
		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: { status: "configuring" },
		});
		expect(routing.pointers).toHaveLength(0);
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledTimes(4);
		expect(dispatcher.triggerConfiguration).toHaveBeenNthCalledWith(4, {
			domainId: row.id,
			nonce: expect.stringMatching(/^manual-restart:/),
		});
		expect(
			(
				repository.rows.get(row.id)?.dns as {
					triggerConfiguration?: { nonce?: string };
				}
			).triggerConfiguration?.nonce,
		).not.toBe(String(row.updatedAt.getTime()));
		expect(dispatcher.recoverConfiguration).not.toHaveBeenCalled();
	});

	it("attaches a BYO domain with only the www CNAME and ownership TXT records", async () => {
		const { dispatcher, repository, service, zones } = setup();
		zones.existingZone = {
			id: "zone_existing",
			nameServers: zoneNameServers,
			status: "active",
		};

		const attached = await service.attachExternal(scope, projectId, {
			name: "brand.com",
		});
		const row = [...repository.rows.values()][0];

		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
		expect(attached.requiredRecords).toEqual([
			expect.objectContaining({ name: "www", type: "CNAME" }),
			expect.objectContaining({ type: "TXT", value: "cf-token" }),
		]);
		expect(attached.requiredRecords).not.toContainEqual(
			expect.objectContaining({ type: "NS" }),
		);
		expect(row?.dns).toEqual({ records: attached.requiredRecords });
		expect(attached.domain.dns).toEqual({ records: attached.requiredRecords });
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledOnce();
	});

	it("rolls back only attach-created hostname state when Trigger handoff fails", async () => {
		const { cloudflare, dispatcher, repository, service, zones } = setup();
		dispatcher.triggerConfiguration.mockRejectedValueOnce(
			new Error("trigger down"),
		);

		await expect(
			service.attachExternal(scope, projectId, { name: "rollback.org" }),
		).rejects.toThrow("trigger down");

		expect(repository.rows.size).toBe(0);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledExactlyOnceWith(
			"cf_1",
		);
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
		expect(zones.deleteZone).not.toHaveBeenCalled();
	});

	it("keeps the attach records unchanged when a pre-zone BYO domain is verified", async () => {
		const { cloudflare, dispatcher, repository, service, zones } = setup();
		// The status probe returns the same challenge the create call handed out.
		cloudflare.requiredRecords = [
			{
				name: "_cf-custom-hostname.example.com",
				type: "TXT",
				value: "cf-token",
			},
		];
		const setDns = vi.spyOn(repository, "setDns");
		const attached = await service.attachExternal(scope, projectId, {
			name: "brand.com",
		});
		const row = [...repository.rows.values()][0];

		if (!row) {
			throw new Error("Expected BYO row");
		}

		const verified = await service.verify(row.id, scope);

		expect(verified.requiredRecords).toEqual(attached.requiredRecords);
		expect(verified.domain.dns?.records).toEqual(attached.requiredRecords);
		// Nothing changed, so no rewrite of dns.records happened.
		expect(setDns).not.toHaveBeenCalled();
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledTimes(2);
		expect(zones.findZoneByName).not.toHaveBeenCalled();
		expect(zones.createZone).not.toHaveBeenCalled();
	});

	it("withdraws the nameservers of a zone that no longer exists when a configuring BYO domain is verified", async () => {
		const { dispatcher, logger, repository, service, zones } = setup();
		const attached = await service.attachExternal(scope, projectId, {
			name: "brand.com",
		});
		const row = [...repository.rows.values()][0];

		if (!row) {
			throw new Error("Expected BYO row");
		}

		const exposedRecords = [...attached.requiredRecords, ...nameserverRecords];
		await repository.updateById(row.id, {
			dns: {
				records: exposedRecords,
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_new",
				zoneNameServers,
				zoneStatus: "pending",
			},
		});
		zones.zoneStatus = null;

		const verified = await service.verify(row.id, scope);

		expect(zones.getZoneStatus).toHaveBeenCalledExactlyOnceWith("zone_new");
		expect(verified.requiredRecords).toEqual(attached.requiredRecords);
		expect(verified.requiredRecords).not.toContainEqual(
			expect.objectContaining({ type: "NS" }),
		);
		expect(verified.domain.dns?.records).toEqual(verified.requiredRecords);
		const dns = domainDnsSchema.parse(repository.rows.get(row.id)?.dns);
		expect(dns).toMatchObject({
			apexError: "Cloudflare zone zone_new no longer exists",
			records: verified.requiredRecords,
		});
		for (const key of [
			"zoneCreated",
			"zoneDelegated",
			"zoneId",
			"zoneNameServers",
			"zoneStatus",
		]) {
			expect(dns).not.toHaveProperty(key);
		}
		expect(logger.warn).toHaveBeenCalledWith(
			`Cloudflare zone zone_new for domain ${row.id} no longer exists; its nameservers are withdrawn`,
		);
		// The redispatched configure task rechecks ownership before replacing it.
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledTimes(2);
	});

	it("withdraws a lost zone from an active BYO domain too and keeps the records when the zone check fails", async () => {
		const { cloudflare, logger, repository, service, zones } = setup();
		cloudflare.status = "active";
		cloudflare.requiredRecords = [
			{
				name: "_cf-custom-hostname.www.brand.com",
				type: "TXT",
				value: "cf-token",
			},
		];
		const records = [
			{
				name: "www",
				purpose: "traffic",
				type: "CNAME" as const,
				value: "customers.wandit.app",
			},
			{
				name: "_cf-custom-hostname.www.brand.com",
				purpose: "ownership_or_ssl_validation",
				type: "TXT" as const,
				value: "cf-token",
			},
			...nameserverRecords,
		];
		const row = repository.seed({
			cfCustomHostnameId: "cf_active",
			dns: {
				apexConfigured: true,
				records,
				zoneDelegated: true,
				zoneId: "zone_active",
				zoneNameServers,
				zoneStatus: "pending",
			},
			name: "brand.com",
			projectId,
			source: "external",
			status: "active",
		});

		zones.getZoneStatus.mockRejectedValueOnce(new Error("Cloudflare down"));
		const kept = await service.verify(row.id, scope);

		expect(kept.requiredRecords).toEqual(records);
		expect(logger.warn).toHaveBeenCalledWith(
			`Cloudflare zone check deferred for external domain ${row.id}`,
			"Cloudflare down",
		);

		zones.zoneStatus = null;
		const withdrawn = await service.verify(row.id, scope);

		expect(withdrawn.requiredRecords).toEqual(records.slice(0, 2));
		expect(withdrawn.domain.status).toBe("active");
		expect(repository.rows.get(row.id)?.dns).toEqual({
			apexError: "Cloudflare zone zone_active no longer exists",
			records: records.slice(0, 2),
		});
	});

	it("persists newly merged Cloudflare records for external domains", async () => {
		const { cloudflare, dispatcher, repository, service } = setup();
		const mergeDns = vi.spyOn(repository, "mergeDnsIfStatus");
		const setDns = vi.spyOn(repository, "setDns");
		cloudflare.requiredRecords = [
			{
				name: "_cf-custom-hostname.brand.com",
				type: "TXT",
				value: "fresh-token",
			},
		];
		const row = repository.seed({
			cfCustomHostnameId: "cf_rotated",
			dns: {
				apexConfigured: true,
				records: [
					{
						name: "_cf-custom-hostname.brand.com",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "old-token",
					},
				],
				triggerConfiguration: {
					nextAttempt: 2,
					nextProbeAt: null,
					nonce: "existing-nonce",
				},
			},
			name: "brand.com",
			projectId,
			source: "external",
			status: "configuring",
		});

		const response = await service.verify(row.id, scope);

		expect(repository.rows.get(row.id)?.dns).toMatchObject({
			apexConfigured: true,
			records: response.requiredRecords,
			triggerConfiguration: {
				nextAttempt: 2,
				nextProbeAt: null,
				nonce: "existing-nonce",
			},
		});
		expect(response.domain.dns?.records).toEqual(response.requiredRecords);
		expect(response.requiredRecords).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "CNAME", name: "www" }),
				expect.objectContaining({ type: "TXT", value: "old-token" }),
				expect.objectContaining({ type: "TXT", value: "fresh-token" }),
			]),
		);
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledWith({
			domainId: row.id,
			nonce: "existing-nonce",
		});
		expect(mergeDns).toHaveBeenCalledExactlyOnceWith(
			row.id,
			["configuring", "active"],
			{ records: response.requiredRecords },
		);
		expect(setDns).not.toHaveBeenCalled();
	});

	it("restarts a fully active external hostname with a fresh cursor and no stalled marker", async () => {
		const { cloudflare, dispatcher, repository, routing, service } = setup();
		cloudflare.status = "active";
		const row = repository.seed({
			cfCustomHostnameId: "cf_sleeping_active",
			dns: {
				records: [],
				triggerConfiguration: {
					nextAttempt: 4,
					nextProbeAt: "2026-08-02T00:15:00.000Z",
					nonce: "sleeping-run",
				},
			},
			name: "active-sleeping.com",
			projectId,
			source: "external",
			status: "configuring",
		});

		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: { status: "configuring" },
		});

		const dispatched = dispatcher.triggerConfiguration.mock.calls[0]?.[0];
		expect(dispatched).toEqual({
			domainId: row.id,
			nonce: expect.stringMatching(/^manual-restart:/),
		});
		expect(dispatched?.nonce).not.toBe("sleeping-run");
		expect(repository.rows.get(row.id)?.dns).toMatchObject({
			triggerConfiguration: {
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: dispatched?.nonce,
			},
		});
		expect(repository.rows.get(row.id)?.dns).not.toHaveProperty(
			"externalVerification",
		);
		expect(routing.pointers).toHaveLength(0);
	});

	it("restarts a stalled external run and clears its warning after handoff", async () => {
		const { dispatcher, repository, service } = setup();
		const stalledAt = "2026-08-02T00:00:30.000Z";
		const row = repository.seed({
			cfCustomHostnameId: "cf_stalled",
			dns: {
				externalVerification: { attempts: 101, stalledAt },
				records: [],
				triggerConfiguration: {
					nextAttempt: 100,
					nextProbeAt: null,
					nonce: "manual:stable-restart",
				},
			},
			name: "stalled.com",
			projectId,
			source: "external",
			status: "configuring",
		});

		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: {
				dns: {
					records: [expect.objectContaining({ name: "www", type: "CNAME" })],
				},
				status: "configuring",
			},
		});

		expect(dispatcher.triggerConfiguration).toHaveBeenCalledWith({
			domainId: row.id,
			nonce: `manual-restart:${stalledAt}`,
		});
		expect(dispatcher.recoverConfiguration).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.dns).toMatchObject({
			triggerConfiguration: {
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: `manual-restart:${stalledAt}`,
			},
		});
		expect(repository.rows.get(row.id)?.dns).not.toHaveProperty(
			"externalVerification",
		);
	});

	it("keeps the stalled marker when the restart handoff fails", async () => {
		const { dispatcher, repository, service } = setup();
		const stalledAt = "2026-08-02T00:00:30.000Z";
		const row = repository.seed({
			cfCustomHostnameId: "cf_stalled",
			dns: {
				externalVerification: { attempts: 101, stalledAt },
				triggerConfiguration: {
					nextAttempt: 100,
					nextProbeAt: null,
					nonce: "manual:stable-restart",
				},
			},
			name: "retry-stalled.com",
			projectId,
			source: "external",
			status: "configuring",
		});
		dispatcher.triggerConfiguration.mockRejectedValueOnce(
			new Error("trigger down"),
		);

		await expect(service.verify(row.id, scope)).rejects.toThrow("trigger down");
		expect(repository.rows.get(row.id)?.dns).toMatchObject({
			externalVerification: { attempts: 101, stalledAt },
		});
	});

	it("clears a stalled marker while handing a fully active external hostname back to the runner", async () => {
		const { cloudflare, dispatcher, repository, routing, service } = setup();
		cloudflare.status = "active";
		const row = repository.seed({
			cfCustomHostnameId: "cf_stalled_active",
			dns: {
				externalVerification: {
					attempts: 101,
					stalledAt: "2026-08-02T00:00:30.000Z",
				},
				records: [],
				triggerConfiguration: {
					nextAttempt: 100,
					nextProbeAt: null,
					nonce: "stalled-active-run",
				},
			},
			name: "active-stalled.com",
			projectId,
			source: "external",
			status: "configuring",
		});

		await expect(service.verify(row.id, scope)).resolves.toMatchObject({
			domain: {
				dns: {
					records: [expect.objectContaining({ name: "www", type: "CNAME" })],
				},
				status: "configuring",
			},
		});
		expect(repository.rows.get(row.id)?.dns).not.toHaveProperty(
			"externalVerification",
		);
		expect(dispatcher.triggerConfiguration).toHaveBeenCalledExactlyOnceWith({
			domainId: row.id,
			nonce: expect.stringMatching(/^manual-restart:/),
		});
		expect(repository.rows.get(row.id)?.dns).toMatchObject({
			triggerConfiguration: {
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: expect.stringMatching(/^manual-restart:/),
			},
		});
		expect(
			(
				repository.rows.get(row.id)?.dns as {
					triggerConfiguration?: { nonce?: string };
				}
			).triggerConfiguration?.nonce,
		).not.toBe("stalled-active-run");
		expect(routing.pointers).toHaveLength(0);
		expect(dispatcher.recoverConfiguration).not.toHaveBeenCalled();
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

	it("detach leaves an external domain's Cloudflare zone in place too", async () => {
		const { cloudflare, logger, repository, service, zones } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_www_ext",
			dns: {
				apexCustomHostnameId: "cf_apex_ext",
				records: [],
				zoneCreated: true,
				zoneDelegated: true,
				zoneId: "zone_ext",
			},
			name: "external-apex.com",
			projectId,
			provider: null,
			source: "external",
			status: "active",
		});

		await service.detach(row.id, scope);

		expect(cloudflare.deleteCustomHostname.mock.calls).toEqual([
			["cf_www_ext"],
			["cf_apex_ext"],
		]);
		expect(zones.deleteZone).not.toHaveBeenCalled();
		expect(logger.log).toHaveBeenCalledWith(
			`Leaving Cloudflare zone zone_ext for detached domain ${row.id} in place`,
		);
	});

	it("detach also deletes the purchased apex custom hostname but leaves the Cloudflare zone", async () => {
		const { cloudflare, logger, repository, service } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_www",
			dns: {
				apexConfigured: true,
				apexCustomHostnameId: "cf_apex",
				records: [],
				zoneCreated: true,
				zoneId: "zone_1",
			},
			name: "apex.com",
			projectId,
			source: "purchased",
			status: "active",
		});

		await service.detach(row.id, scope);

		expect(cloudflare.deleteCustomHostname.mock.calls).toEqual([
			["cf_www"],
			["cf_apex"],
		]);
		expect(logger.log).toHaveBeenCalledWith(
			`Leaving Cloudflare zone zone_1 for detached domain ${row.id} in place`,
		);
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
