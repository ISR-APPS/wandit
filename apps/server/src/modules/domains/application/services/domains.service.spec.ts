import {
	DOMAIN_TLD_CATALOG,
	type DomainPriceSnapshot,
	purchaseDomainBodySchema,
	type RequiredDomainRecord,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../credits/domain/errors/insufficient-credits.error";
import {
	DomainAlreadyExistsError,
	DomainsUnavailableError,
	PremiumDomainBlockedError,
} from "../../domain/errors/domain.errors";
import type { CreditsPort } from "../../domain/ports/credits.port";
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
		priceSnapshot: DomainPriceSnapshot;
		projectId: string;
		registrant: typeof validRegistrant;
		tld: string;
		userId: string;
	}) {
		const row = this.makeRow({
			name: input.name,
			priceSnapshot: input.priceSnapshot,
			projectId: input.projectId,
			provider: "openprovider",
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
		priceSnapshot: DomainPriceSnapshot;
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
			paymentOrderId: null,
			priceSnapshot: null,
			projectId,
			provider: "openprovider",
			providerDomainId: null,
			registrant: null,
			source: "purchased",
			status: "registering",
			tld: "com",
			updatedAt: now,
			userId,
			whoisPrivacy: true,
			...rest,
		} satisfies DomainRow;
	}
}

class FakeCreditsPort implements CreditsPort {
	readonly consumeLedgerKeys: string[] = [];
	private readonly consumedKeys = new Set<string>();
	readonly consume = vi.fn(
		async (
			_userId: string,
			_amount: number,
			options: { idempotencyKey: string },
		) => {
			if (this.consumedKeys.has(options.idempotencyKey)) {
				return;
			}

			this.consumedKeys.add(options.idempotencyKey);
			this.consumeLedgerKeys.push(options.idempotencyKey);
		},
	);
	readonly grant = vi.fn(async () => undefined);
}

class FakeProvider implements DomainProvider {
	availability: DomainAvailability[] = [];
	authCode = "AUTH-SECRET";
	lockCalls: Array<{ locked: boolean; name: string }> = [];

	async checkAvailability(names: string[]) {
		return names.map(
			(name) =>
				this.availability.find((item) => item.name === name) ?? {
					available: true,
					name,
					wholesalePriceUsd: 8,
				},
		);
	}

	async register() {
		return {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "op_1",
		};
	}

	readonly renew = vi.fn(async () => {
		return { expiresAt: new Date("2028-01-01T00:00:00.000Z") };
	});

	async setDnsRecords(_name: string, _records: DomainDnsRecord[]) {}

	async setUrlForwarding() {}

	async getAuthCode() {
		return this.authCode;
	}

	async setTransferLock(name: string, locked: boolean) {
		this.lockCalls.push({ locked, name });
	}

	async getDomainInfo(): Promise<DomainProviderInfo | null> {
		return null;
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

function priceSnapshot(tld = "com"): DomainPriceSnapshot {
	const catalog = DOMAIN_TLD_CATALOG.com;

	return {
		registrationCredits: catalog.registrationCredits,
		renewalCredits: catalog.renewalCredits,
		tld: tld as DomainPriceSnapshot["tld"],
		wholesaleCeilingUsd: catalog.wholesaleCeilingUsd,
	};
}

function nextExpiryYear(row: DomainRow): number {
	if (!row.expiresAt) {
		throw new Error(`Expected ${row.name} to have an expiry date`);
	}

	return row.expiresAt.getUTCFullYear() + 1;
}

function setQueueEnabled(enabled: boolean) {
	process.env.QUEUE_ENABLED = enabled ? "true" : "false";
}

function setup() {
	setQueueEnabled(true);
	const repository = new FakeDomainsRepository();
	const credits = new FakeCreditsPort();
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
		credits,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		logger,
		queue as never,
	);

	return {
		cloudflare,
		credits,
		logger,
		provider,
		queue,
		repository,
		routing,
		service,
	};
}

describe("DomainsService", () => {
	it("purchases by creating a row, consuming credits, then enqueueing the job", async () => {
		const { credits, queue, repository, service } = setup();

		const response = await service.purchase(userId, projectId, {
			name: "Example.COM",
			registrant: validRegistrant,
		});

		const [row] = [...repository.rows.values()];
		expect(row?.name).toBe("example.com");
		expect(credits.consume).toHaveBeenCalledWith(
			userId,
			DOMAIN_TLD_CATALOG.com.registrationCredits,
			expect.objectContaining({
				idempotencyKey: `domain-purchase:${row?.id}`,
			}),
		);
		expect(queue.add).toHaveBeenCalledWith(
			"domain-purchase",
			{ domainId: row?.id },
			{
				attempts: 5,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				jobId: `domain-purchase-${row?.id}`,
			},
		);
		expect("providerDomainId" in response.domain).toBe(false);
		expect(response.domain.priceSnapshot).not.toHaveProperty(
			"wholesaleCeilingUsd",
		);
	});

	it("propagates insufficient credits and deletes the created registering row", async () => {
		const { credits, queue, repository, service } = setup();
		credits.consume.mockRejectedValueOnce(new InsufficientCreditsError(120, 5));

		await expect(
			service.purchase(userId, projectId, {
				name: "example.com",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(InsufficientCreditsError);
		expect(repository.rows.size).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
	});

	it("rejects premium purchases before creating rows or consuming credits", async () => {
		const { credits, provider, repository, service } = setup();
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

		expect(repository.rows.size).toBe(0);
		expect(credits.consume).not.toHaveBeenCalled();
	});

	it("fails closed before creating rows or consuming credits when domain jobs are disabled", async () => {
		const { credits, repository, service } = setup();
		setQueueEnabled(false);

		await expect(
			service.purchase(userId, projectId, {
				name: "example.com",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(DomainsUnavailableError);

		expect(repository.rows.size).toBe(0);
		expect(credits.consume).not.toHaveBeenCalled();
	});

	it("rotates renewal consume and refund keys after a failed provider renewal", async () => {
		const { credits, provider, repository, service } = setup();
		const row = repository.seed({
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			name: "renew-retry.com",
			priceSnapshot: priceSnapshot(),
			providerDomainId: "op_renew",
			source: "purchased",
			status: "active",
		});
		const periodEndYear = nextExpiryYear(row);
		const firstAttemptMs = row.updatedAt.getTime();
		provider.renew.mockRejectedValueOnce(new Error("registrar down"));

		await expect(service.renew(row.id, userId)).rejects.toThrow(
			"registrar down",
		);
		const retryRow = repository.rows.get(row.id);

		if (!retryRow) {
			throw new Error("Expected renewal row to remain after failed attempt");
		}

		await service.renew(row.id, userId);

		expect(credits.consumeLedgerKeys).toEqual([
			`domain-renew:${row.id}:${periodEndYear}:${firstAttemptMs}`,
			`domain-renew:${row.id}:${periodEndYear}:${retryRow.updatedAt.getTime()}`,
		]);
		expect(credits.grant).toHaveBeenCalledWith(
			userId,
			DOMAIN_TLD_CATALOG.com.renewalCredits,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: `domain-renew-refund:${row.id}:${periodEndYear}:${firstAttemptMs}`,
			}),
		);
	});

	it("deduplicates same-instant renewal submits that read the same updatedAt", async () => {
		const { credits, repository, service } = setup();
		const row = repository.seed({
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			name: "renew-double-submit.com",
			priceSnapshot: priceSnapshot(),
			providerDomainId: "op_renew",
			source: "purchased",
			status: "active",
		});

		await Promise.all([
			service.renew(row.id, userId),
			service.renew(row.id, userId),
		]);

		expect(credits.consume).toHaveBeenCalledTimes(2);
		expect(credits.consumeLedgerKeys).toEqual([
			`domain-renew:${row.id}:${nextExpiryYear(row)}:${row.updatedAt.getTime()}`,
		]);
	});

	it("replaces terminal rows when purchasing the same domain again", async () => {
		const { repository, service } = setup();
		const failed = repository.seed({
			name: "retry.com",
			source: "purchased",
			status: "failed",
			userId: "other_user",
		});

		const response = await service.purchase(userId, projectId, {
			name: "retry.com",
			registrant: validRegistrant,
		});

		expect(response.domain.name).toBe("retry.com");
		expect(response.domain.id).not.toBe(failed.id);
		expect(repository.rows.has(failed.id)).toBe(false);
		expect(repository.rows.size).toBe(1);
	});

	it("keeps non-terminal rows as unique-name conflicts", async () => {
		const { repository, service } = setup();
		repository.seed({
			name: "live.com",
			source: "purchased",
			status: "active",
		});

		await expect(
			service.purchase(userId, projectId, {
				name: "live.com",
				registrant: validRegistrant,
			}),
		).rejects.toBeInstanceOf(DomainAlreadyExistsError);
	});

	it("uses catalog prices in search and never exposes wholesale prices", async () => {
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
				wholesalePriceUsd: 900,
			},
		];

		const response = await service.search(userId, "shop");

		expect(response.results[0]).toMatchObject({
			availability: "available",
			name: "shop.com",
			registrationCredits: DOMAIN_TLD_CATALOG.com.registrationCredits,
		});
		expect(response.results[1]).toMatchObject({
			availability: "premium_blocked",
			name: "shop.net",
			registrationCredits: DOMAIN_TLD_CATALOG.net.registrationCredits,
		});
		expect(JSON.stringify(response)).not.toContain("900");
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
				jobId: `domain-configure-${row.id}-${row.updatedAt.getTime()}-0`,
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

	it("never reactivates a failed domain through manual verification", async () => {
		const { cloudflare, repository, routing, service } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_failed",
			name: "failed-money.com",
			source: "purchased",
			status: "failed",
		});
		cloudflare.status = "active";

		await expect(service.verify(row.id, userId)).rejects.toThrow(
			"Only configuring domains can be verified",
		);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(routing.pointers).toHaveLength(0);
		expect(cloudflare.getCustomHostnameStatus).not.toHaveBeenCalled();
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
			priceSnapshot: priceSnapshot(),
			projectId,
			source: "purchased",
			status: "active",
		});
		const second = repository.seed({
			cfCustomHostnameId: "cf_detach",
			name: "second.com",
			priceSnapshot: priceSnapshot(),
			projectId,
			source: "purchased",
			status: "active",
		});

		await service.setPrimary(second.id, userId);
		expect(repository.rows.get(first.id)?.isPrimary).toBe(false);
		expect(repository.rows.get(second.id)?.isPrimary).toBe(true);

		const detached = await service.detach(second.id, userId);
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
			priceSnapshot: priceSnapshot(),
			providerDomainId: "op_1",
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
