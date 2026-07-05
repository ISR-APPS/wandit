import {
	DOMAIN_TLD_CATALOG,
	type DomainPriceSnapshot,
	type Registrant,
} from "@wandit/contracts";
import type {
	DomainConfigureJobData,
	DomainJobName,
	DomainPurchaseJobData,
} from "@wandit/jobs";
import { describe, expect, it, vi } from "vitest";

import { InsufficientCreditsError } from "../../../server/src/modules/credits/domain/errors/insufficient-credits.error";
import type { CreditsPort } from "../../../server/src/modules/domains/domain/ports/credits.port";
import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
} from "../../../server/src/modules/domains/domain/ports/domain-provider.port";
import type { CustomHostnameService } from "../../../server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service";
import type { DomainRoutingService } from "../../../server/src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import type {
	DomainRow,
	DomainsRepository,
} from "../../../server/src/modules/domains/infrastructure/persistence/domains.repository";
import { DomainsProcessor } from "./domains.processor";

const userId = "user_1";
const projectId = "11111111-1111-4111-8111-111111111111";
const dayMs = 24 * 60 * 60 * 1000;

const registrant = {
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
} satisfies Registrant;

class FakeDomainsRepository {
	readonly rows = new Map<string, DomainRow>();
	private nextId = 1;

	constructor(private readonly events: string[]) {}

	async getById(id: string) {
		return this.rows.get(id) ?? null;
	}

	async updateById(id: string, patch: Partial<DomainRow>) {
		const row = this.expect(id);
		const updated = {
			...row,
			...patch,
			updatedAt: new Date(row.updatedAt.getTime() + 1000),
		} satisfies DomainRow;
		this.rows.set(id, updated);

		return updated;
	}

	async updateIfStatus(
		id: string,
		statuses: DomainRow["status"][],
		patch: Partial<DomainRow>,
	) {
		const row = this.expect(id);

		if (!statuses.includes(row.status)) {
			throw new Error("Invalid status");
		}

		return this.updateById(id, patch);
	}

	async setDns(id: string, dns: DomainRow["dns"]) {
		return this.updateById(id, { dns });
	}

	async markFailed(id: string, summary: string) {
		this.events.push(`markFailed:${id}:${summary}`);

		return this.updateById(id, {
			error: summary,
			isPrimary: false,
			status: "failed",
		});
	}

	async findRenewalCandidates(now = new Date()) {
		const renewBy = new Date(now);
		renewBy.setUTCDate(renewBy.getUTCDate() + 30);

		return [...this.rows.values()]
			.filter(
				(row) =>
					row.source === "purchased" &&
					row.autoRenew &&
					(row.status === "active" || row.status === "expired") &&
					row.expiresAt !== null &&
					row.expiresAt <= renewBy,
			)
			.sort((left, right) => {
				const byExpiry =
					(left.expiresAt?.getTime() ?? 0) - (right.expiresAt?.getTime() ?? 0);

				return byExpiry || left.id.localeCompare(right.id);
			});
	}

	async recordRenewalNotice(id: string, message: string) {
		return this.updateById(id, { error: message });
	}

	async findPurchasedForSync() {
		return [...this.rows.values()].filter(
			(row) => row.source === "purchased" && row.providerDomainId,
		);
	}

	seed(input: Partial<DomainRow> & Pick<DomainRow, "name" | "status">) {
		const { name, status, ...rest } = input;
		const id = `22222222-2222-4222-8222-${String(this.nextId).padStart(12, "0")}`;
		const now = new Date(1_700_000_000_000 + this.nextId * 1000);
		this.nextId += 1;
		const row = {
			autoRenew: true,
			cfCustomHostnameId: null,
			createdAt: now,
			dns: null,
			error: null,
			expiresAt: null,
			id,
			isPrimary: false,
			name,
			priceSnapshot: priceSnapshot(),
			projectId,
			provider: "openprovider",
			providerDomainId: null,
			registrant,
			source: "purchased",
			status,
			tld: "com",
			updatedAt: now,
			userId,
			whoisPrivacy: true,
			...rest,
		} satisfies DomainRow;
		this.rows.set(row.id, row);

		return row;
	}

	private expect(id: string) {
		const row = this.rows.get(id);

		if (!row) {
			throw new Error(`Missing row ${id}`);
		}

		return row;
	}
}

class FakeProvider implements DomainProvider {
	availability: DomainAvailability[] = [];
	availabilityNames: string[][] = [];
	info: DomainProviderInfo | null = null;
	registerCalls = 0;
	registerError: Error | null = null;
	renewCalls = 0;
	renewErrors: Error[] = [];
	renewedExpiresAt = new Date("2027-08-01T00:00:00.000Z");
	readonly setDnsRecordsMock = vi.fn(async () => undefined);
	readonly setUrlForwardingMock = vi.fn(async () => undefined);

	async checkAvailability(names: string[]) {
		this.availabilityNames.push(names);

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
		this.registerCalls += 1;

		if (this.registerError) {
			throw this.registerError;
		}

		return {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "op_registered",
		};
	}

	async renew() {
		this.renewCalls += 1;

		const error = this.renewErrors.shift();

		if (error) {
			throw error;
		}

		return { expiresAt: this.renewedExpiresAt };
	}

	async setDnsRecords(_name: string, _records: DomainDnsRecord[]) {
		return this.setDnsRecordsMock();
	}

	async setUrlForwarding() {
		return this.setUrlForwardingMock();
	}

	async getAuthCode() {
		return "AUTH";
	}

	async setTransferLock() {}

	async getDomainInfo() {
		return this.info;
	}
}

class FakeCredits implements CreditsPort {
	readonly consumeLedgerKeys: string[] = [];
	private readonly consumedKeys = new Set<string>();
	grantFailures = 0;

	constructor(private readonly events: string[]) {}

	readonly consume = vi.fn(
		async (
			_userId: string,
			_amount: number,
			options?: { idempotencyKey?: string },
		) => {
			const key = options?.idempotencyKey ?? "missing-key";

			if (this.consumedKeys.has(key)) {
				return;
			}

			this.consumedKeys.add(key);
			this.consumeLedgerKeys.push(key);
			this.events.push(`consume:${key}`);
		},
	);

	readonly grant = vi.fn(
		async (
			_userId: string,
			_amount: number,
			options: { idempotencyKey?: string },
		) => {
			this.events.push(`grant:${options.idempotencyKey ?? "missing-key"}`);

			if (this.grantFailures > 0) {
				this.grantFailures -= 1;
				throw new Error("ledger down");
			}
		},
	);
}

class FakeCustomHostnameService {
	status = "pending";
	readonly createCustomHostname = vi.fn(async () => ({
		hostnameStatus: "pending",
		id: "cf_1",
		requiredRecords: [],
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
	readonly putDomainPointer = vi.fn(async () => undefined);
	readonly deleteDomainPointer = vi.fn(async () => undefined);
	readonly refreshProjectDomains = vi.fn(async () => undefined);
}

function priceSnapshot(): DomainPriceSnapshot {
	return {
		registrationCredits: DOMAIN_TLD_CATALOG.com.registrationCredits,
		renewalCredits: DOMAIN_TLD_CATALOG.com.renewalCredits,
		tld: "com",
		wholesaleCeilingUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd,
	};
}

function nextExpiryYear(row: DomainRow): number {
	if (!row.expiresAt) {
		throw new Error(`Expected ${row.name} to have an expiry date`);
	}

	return row.expiresAt.getUTCFullYear() + 1;
}

function setup() {
	const events: string[] = [];
	const repository = new FakeDomainsRepository(events);
	const provider = new FakeProvider();
	const credits = new FakeCredits(events);
	const cloudflare = new FakeCustomHostnameService();
	const routing = new FakeRoutingService();
	const queue = {
		add: vi.fn(async () => undefined),
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const processor = new DomainsProcessor(
		repository as unknown as DomainsRepository,
		provider,
		credits,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		queue as never,
	);

	return {
		cloudflare,
		credits,
		events,
		processor,
		provider,
		queue,
		repository,
		routing,
	};
}

type ProcessorJob = Parameters<DomainsProcessor["process"]>[0];

type ProcessorInternals = {
	processDomainRenewals(now?: Date): Promise<{
		processed: boolean;
		renewed: number;
		skipped: number;
	}>;
	renewCandidate(row: DomainRow): Promise<boolean>;
};

function job<Name extends DomainJobName>(
	name: Name,
	data: Name extends "domain-purchase"
		? DomainPurchaseJobData
		: Name extends "domain-configure"
			? DomainConfigureJobData
			: Record<string, never>,
	options: { attempts?: number; attemptsMade?: number; id?: string } = {},
) {
	return {
		attemptsMade: options.attemptsMade ?? 0,
		data,
		id: options.id,
		name,
		opts: { attempts: options.attempts },
	} as unknown as ProcessorJob;
}

describe("DomainsProcessor", () => {
	it("re-checks real-domain availability and terminally refunds over-ceiling purchase jobs", async () => {
		const { credits, cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_cleanup",
			name: "premium.com",
			status: "registering",
		});
		provider.availability = [
			{
				available: true,
				name: "premium.com",
				wholesalePriceUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd + 1,
			},
		];

		await processor.process(
			job("domain-purchase", { domainId: row.id }, { attempts: 5 }),
		);
		await processor.process(
			job("domain-purchase", { domainId: row.id }, { attempts: 5 }),
		);

		expect(provider.availabilityNames).toEqual([["premium.com"]]);
		expect(provider.registerCalls).toBe(0);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(credits.grant).toHaveBeenCalledTimes(1);
		expect(credits.grant).toHaveBeenCalledWith(
			userId,
			DOMAIN_TLD_CATALOG.com.registrationCredits,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: `domain-refund:${row.id}`,
				meta: { domainId: row.id, reason: "domain_registration_failed" },
			}),
		);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_cleanup");
	});

	it("rethrows transient purchase failures while attempts remain without refunding or marking failed", async () => {
		const { credits, events, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "transient.com",
			status: "registering",
		});
		provider.registerError = new Error("network timeout");

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{ attempts: 5, attemptsMade: 0 },
				),
			),
		).rejects.toThrow("network timeout");

		expect(repository.rows.get(row.id)?.status).toBe("registering");
		expect(credits.grant).not.toHaveBeenCalled();
		expect(events.some((event) => event.startsWith("markFailed"))).toBe(false);
	});

	it("terminal purchase errors refund and mark failed immediately even with attempts remaining", async () => {
		const { credits, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "taken.com",
			status: "registering",
		});
		provider.availability = [
			{
				available: false,
				name: "taken.com",
			},
		];

		await processor.process(
			job(
				"domain-purchase",
				{ domainId: row.id },
				{ attempts: 5, attemptsMade: 0 },
			),
		);

		expect(credits.grant).toHaveBeenCalledTimes(1);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
	});

	it("exhausted transient purchase attempts refund with a generic stored failure summary", async () => {
		const { credits, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "exhausted.com",
			status: "registering",
		});
		provider.registerError = new Error("connect ECONNREFUSED 10.2.3.4:6379");

		await processor.process(
			job(
				"domain-purchase",
				{ domainId: row.id },
				{ attempts: 5, attemptsMade: 4 },
			),
		);

		expect(credits.grant).toHaveBeenCalledTimes(1);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.error).toBe(
			"Domain registration failed",
		);
	});

	it("grants purchase refunds before markFailed and retries the refund once", async () => {
		const { credits, events, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "refund-order.com",
			status: "registering",
		});
		provider.availability = [{ available: false, name: "refund-order.com" }];
		credits.grantFailures = 1;

		await processor.process(
			job("domain-purchase", { domainId: row.id }, { attempts: 5 }),
		);

		expect(credits.grant).toHaveBeenCalledTimes(2);
		expect(events).toEqual([
			`grant:domain-refund:${row.id}`,
			`grant:domain-refund:${row.id}`,
			`markFailed:${row.id}:Domain registration failed`,
		]);
	});

	it("logs refund replay details and does not mark failed when purchase refund finally fails", async () => {
		const { credits, events, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "refund-down.com",
			status: "registering",
		});
		provider.availability = [{ available: false, name: "refund-down.com" }];
		credits.grantFailures = 2;
		const loggerError = vi
			.spyOn(
				(
					processor as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			processor.process(
				job("domain-purchase", { domainId: row.id }, { attempts: 5 }),
			),
		).rejects.toThrow("ledger down");

		expect(events).toEqual([
			`grant:domain-refund:${row.id}`,
			`grant:domain-refund:${row.id}`,
		]);
		expect(repository.rows.get(row.id)?.status).toBe("registering");
		expect(loggerError).toHaveBeenCalledWith(
			"Domain purchase refund failed",
			expect.stringContaining(`"idempotencyKey":"domain-refund:${row.id}"`),
		);
		loggerError.mockRestore();
	});

	it("detects prior registrar success and never double-registers on rerun", async () => {
		const { processor, provider, queue, repository } = setup();
		const row = repository.seed({
			name: "partial.com",
			status: "registering",
		});
		const nonce = String(row.updatedAt.getTime());
		provider.info = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			id: "op_existing",
		};

		await processor.process(job("domain-purchase", { domainId: row.id }));
		await processor.process(job("domain-purchase", { domainId: row.id }));

		expect(provider.registerCalls).toBe(0);
		expect(provider.availabilityNames).toEqual([]);
		expect(repository.rows.get(row.id)?.providerDomainId).toBe("op_existing");
		expect(repository.rows.get(row.id)?.status).toBe("configuring");
		expect(queue.add).toHaveBeenCalledWith(
			"domain-configure",
			{ attempt: 0, domainId: row.id, nonce },
			{
				attempts: 3,
				backoff: {
					delay: 60_000,
					type: "exponential",
				},
				jobId: `domain-configure:${row.id}:${nonce}:0`,
				removeOnComplete: 1000,
				removeOnFail: 5000,
			},
		);
	});

	it("re-enqueues configure jobs on transient Cloudflare failures instead of failing the chain", async () => {
		const { cloudflare, processor, queue, repository } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_1",
			name: "configure.com",
			status: "configuring",
		});
		cloudflare.getCustomHostnameStatus.mockRejectedValueOnce(
			new Error("cf timeout"),
		);

		await expect(
			processor.process(
				job("domain-configure", {
					attempt: 2,
					domainId: row.id,
					nonce: "chain-1",
				}),
			),
		).resolves.toMatchObject({
			processed: false,
			reason: "transient_retry",
		});

		expect(queue.add).toHaveBeenCalledWith(
			"domain-configure",
			{ attempt: 3, domainId: row.id, nonce: "chain-1" },
			expect.objectContaining({
				attempts: 3,
				delay: 120_000,
				jobId: `domain-configure:${row.id}:chain-1:3`,
				removeOnComplete: 1000,
				removeOnFail: 5000,
			}),
		);
	});

	it("renews only purchased active or expired domains inside the <=30d window", async () => {
		const { credits, processor, provider, repository } = setup();
		const now = new Date("2027-01-01T00:00:00.000Z");
		const due = repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "renew.com",
			providerDomainId: "op_renew",
			status: "active",
		});
		repository.seed({
			expiresAt: new Date(now.getTime() + 60 * dayMs),
			name: "too-early.com",
			providerDomainId: "op_far",
			status: "active",
		});
		repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "failed.com",
			providerDomainId: "op_failed",
			status: "failed",
		});
		repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "external.com",
			providerDomainId: null,
			source: "external",
			status: "configuring",
		});

		await (processor as unknown as ProcessorInternals).processDomainRenewals(
			now,
		);

		expect(credits.consume).toHaveBeenCalledTimes(1);
		expect(credits.consume).toHaveBeenCalledWith(
			userId,
			DOMAIN_TLD_CATALOG.com.renewalCredits,
			expect.objectContaining({
				idempotencyKey: `domain-renew:${due.id}:${nextExpiryYear(due)}:${due.updatedAt.getTime()}`,
			}),
		);
		expect(provider.renewCalls).toBe(1);
	});

	it("charges renewal retries again after a failed provider renewal rotates updatedAt", async () => {
		const { credits, processor, provider, repository } = setup();
		const now = new Date("2027-01-01T00:00:00.000Z");
		const row = repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "renew-retry.com",
			providerDomainId: "op_renew",
			status: "active",
		});
		const periodEndYear = nextExpiryYear(row);
		const firstAttemptMs = row.updatedAt.getTime();
		provider.renewErrors.push(new Error("registrar down"));

		await expect(
			(processor as unknown as ProcessorInternals).processDomainRenewals(now),
		).rejects.toThrow("registrar down");
		const retryRow = repository.rows.get(row.id);

		if (!retryRow) {
			throw new Error("Expected renewal row to remain after failed attempt");
		}

		await (processor as unknown as ProcessorInternals).processDomainRenewals(
			now,
		);

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

	it("deduplicates same-updatedAt renewal candidates on the consume key", async () => {
		const { credits, processor, repository } = setup();
		const row = repository.seed({
			expiresAt: new Date("2027-01-21T00:00:00.000Z"),
			name: "renew-double-submit.com",
			providerDomainId: "op_renew",
			status: "active",
		});
		const internals = processor as unknown as ProcessorInternals;

		await Promise.all([
			internals.renewCandidate(row),
			internals.renewCandidate(row),
		]);

		expect(credits.consume).toHaveBeenCalledTimes(2);
		expect(credits.consumeLedgerKeys).toEqual([
			`domain-renew:${row.id}:${nextExpiryYear(row)}:${row.updatedAt.getTime()}`,
		]);
	});

	it("records insufficient-credit notices and stops attempting renewals at T-5", async () => {
		const { credits, processor, provider, repository } = setup();
		const now = new Date("2027-01-01T00:00:00.000Z");
		const insufficient = repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "insufficient.com",
			providerDomainId: "op_insufficient",
			status: "active",
		});
		const cutoff = repository.seed({
			expiresAt: new Date(now.getTime() + 4 * dayMs),
			name: "cutoff.com",
			providerDomainId: "op_cutoff",
			status: "active",
		});
		credits.consume.mockRejectedValue(new InsufficientCreditsError(120, 0));

		await (processor as unknown as ProcessorInternals).processDomainRenewals(
			now,
		);

		expect(provider.renewCalls).toBe(0);
		expect(repository.rows.get(insufficient.id)?.expiresAt).toEqual(
			insufficient.expiresAt,
		);
		expect(repository.rows.get(insufficient.id)?.error).toContain(
			"credits were not available",
		);
		expect(repository.rows.get(cutoff.id)?.error).toContain("T-5");
		expect(credits.consume).toHaveBeenCalledTimes(1);
	});
});
