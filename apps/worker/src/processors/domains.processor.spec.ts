import { DOMAIN_TLD_CATALOG, type Registrant } from "@wandit/contracts";
import type {
	DomainConfigureJobData,
	DomainJobName,
	DomainPurchaseJobData,
	DomainSyncJobData,
} from "@wandit/jobs";
import { describe, expect, it, vi } from "vitest";

import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
	DomainRegistrationOptions,
	DomainRegistrationResult,
} from "../../../server/src/modules/domains/domain/ports/domain-provider.port";
import type {
	CustomHostnameResult,
	CustomHostnameService,
} from "../../../server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service";
import type { DomainRoutingService } from "../../../server/src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import type {
	DomainRow,
	DomainsRepository,
} from "../../../server/src/modules/domains/infrastructure/persistence/domains.repository";
import { DomainsProcessor } from "./domains.processor";

vi.mock("@wandit/env/server", () => ({
	env: { DOMAINS_FALLBACK_ORIGIN: "customers.wandit.app" },
}));

const userId = "user_1";
const projectId = "11111111-1111-4111-8111-111111111111";

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
	readonly events: string[] = [];
	readonly rows = new Map<string, DomainRow>();
	private nextId = 1;

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

	async findPurchasedForSync() {
		return [...this.rows.values()].filter(
			(row) =>
				row.source === "purchased" &&
				row.provider === "namecom" &&
				Boolean(row.providerDomainId) &&
				row.status !== "failed" &&
				row.status !== "transferred_out",
		);
	}

	seed(input: Partial<DomainRow> & Pick<DomainRow, "name" | "status">) {
		const { name, status, ...rest } = input;
		const id = `22222222-2222-4222-8222-${String(this.nextId).padStart(12, "0")}`;
		const now = new Date(1_700_000_000_000 + this.nextId * 1000);
		this.nextId += 1;
		const row = {
			autoRenew: false,
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
			registrant,
			source: "purchased",
			status,
			tld: "com",
			transferLockExpiresAt: null,
			updatedAt: now,
			userId,
			whoisPrivacy: false,
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
	readonly availability = new Map<string, DomainAvailability>();
	readonly info = new Map<string, DomainProviderInfo>();
	registerError: Error | null = null;
	registrationResult: DomainRegistrationResult = {
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		providerDomainId: "namecom_registered",
		providerOrderId: "namecom_order_123",
		totalPaidUsd: 12.34,
		transferLockExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
	};

	readonly checkAvailability = vi.fn(async (names: string[]) =>
		names.map(
			(name) =>
				this.availability.get(name) ?? {
					available: true,
					name,
					wholesalePriceUsd: 8,
				},
		),
	);

	readonly register = vi.fn(
		async (
			_name: string,
			_registrant: Registrant,
			_options: DomainRegistrationOptions,
		) => {
			if (this.registerError) {
				throw this.registerError;
			}

			return this.registrationResult;
		},
	);

	readonly renew = vi.fn(async () => ({ expiresAt: null }));

	readonly setDnsRecords = vi.fn(
		async (_name: string, _records: DomainDnsRecord[]) => undefined,
	);

	readonly setUrlForwarding = vi.fn(
		async (_name: string, _target: string) => undefined,
	);

	readonly getAuthCode = vi.fn(async () => "AUTH");

	readonly setTransferLock = vi.fn(
		async (_name: string, _locked: boolean) => undefined,
	);

	readonly getDomainInfo = vi.fn(
		async (name: string) => this.info.get(name) ?? null,
	);
}

class FakeCustomHostnameService {
	createResult: CustomHostnameResult = {
		hostnameStatus: "pending",
		id: "cf_1",
		requiredRecords: [],
		sslStatus: "pending_validation",
		status: "pending",
	};

	statusResult: CustomHostnameResult = {
		hostnameStatus: "pending",
		id: "cf_1",
		requiredRecords: [],
		sslStatus: "pending_validation",
		status: "pending",
	};

	readonly createCustomHostname = vi.fn(
		async (_name: string) => this.createResult,
	);

	readonly getCustomHostnameStatus = vi.fn(
		async (_id: string) => this.statusResult,
	);

	readonly deleteCustomHostname = vi.fn(async (_id: string) => undefined);
}

class FakeRoutingService {
	readonly putDomainPointer = vi.fn(
		async (_name: string, _pointer: { projectId: string; source: "domain" }) =>
			undefined,
	);
	readonly deleteDomainPointer = vi.fn(async () => undefined);
	readonly refreshProjectDomains = vi.fn(async () => undefined);
}

function setup() {
	const repository = new FakeDomainsRepository();
	const provider = new FakeProvider();
	const cloudflare = new FakeCustomHostnameService();
	const routing = new FakeRoutingService();
	const queue = {
		add: vi.fn(async () => undefined),
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const processor = new DomainsProcessor(
		repository as unknown as DomainsRepository,
		provider,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		queue as never,
	);

	return {
		cloudflare,
		processor,
		provider,
		queue,
		repository,
		routing,
	};
}

type ProcessorJob = Parameters<DomainsProcessor["process"]>[0];

type JobData<Name extends DomainJobName> = Name extends "domain-purchase"
	? DomainPurchaseJobData
	: Name extends "domain-configure"
		? DomainConfigureJobData
		: DomainSyncJobData;

function job<Name extends DomainJobName>(
	name: Name,
	data: JobData<Name>,
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

function processorLogger(processor: DomainsProcessor) {
	return (
		processor as unknown as {
			logger: {
				error: (...args: unknown[]) => void;
				warn: (...args: unknown[]) => void;
			};
		}
	).logger;
}

describe("DomainsProcessor", () => {
	it("registers only the weekly domain-sync scheduler", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"domain-sync-weekly",
			{ pattern: "0 3 * * 0" },
			{
				data: {},
				name: "domain-sync",
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		expect(JSON.stringify(queue.upsertJobScheduler.mock.calls)).not.toContain(
			"renew",
		);
	});

	it("rejects historical OpenProvider rows instead of mutating a registrar", async () => {
		const { processor, provider, repository } = setup();
		const row = repository.seed({
			name: "legacy.com",
			provider: "openprovider",
			status: "registering",
		});

		await expect(
			processor.process(job("domain-purchase", { domainId: row.id })),
		).resolves.toEqual({
			processed: false,
			reason: "unsupported_provider",
		});

		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Unsupported registrar for this worker",
			status: "failed",
		});
		expect(provider.checkAvailability).not.toHaveBeenCalled();
		expect(provider.register).not.toHaveBeenCalled();
	});

	it("passes a stable registration idempotency key and stores the Name.com receipt", async () => {
		const { processor, provider, queue, repository } = setup();
		const row = repository.seed({
			name: "receipt.com",
			status: "registering",
			whoisPrivacy: true,
		});

		await processor.process(
			job("domain-purchase", { domainId: row.id }, { id: "purchase-job-1" }),
		);

		expect(provider.register).toHaveBeenCalledTimes(1);
		expect(provider.register).toHaveBeenCalledWith("receipt.com", registrant, {
			idempotencyKey: `domain-purchase:${row.id}`,
			privacy: true,
			years: 1,
		});
		expect(repository.rows.get(row.id)).toMatchObject({
			expiresAt: provider.registrationResult.expiresAt,
			providerDomainId: "namecom_registered",
			providerOrderId: "namecom_order_123",
			providerTotalPaidUsd: "12.34",
			status: "configuring",
			transferLockExpiresAt: provider.registrationResult.transferLockExpiresAt,
		});
		expect(provider.setDnsRecords).toHaveBeenCalledWith("receipt.com", [
			{
				name: "www",
				type: "CNAME",
				value: "customers.wandit.app",
			},
		]);
		expect(provider.setUrlForwarding).toHaveBeenCalledWith(
			"receipt.com",
			"https://www.receipt.com",
		);
		expect(queue.add).toHaveBeenCalledWith(
			"domain-configure",
			{
				attempt: 0,
				domainId: row.id,
				nonce: "purchase-job-1",
			},
			expect.objectContaining({
				jobId: `domain-configure:${row.id}:purchase-job-1:0`,
			}),
		);
	});

	it("persists Cloudflare validation records and sends their TXT values to Name.com", async () => {
		const { cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "validation.com",
			status: "registering",
		});
		cloudflare.createResult = {
			hostnameStatus: "pending",
			id: "cf_validation",
			requiredRecords: [
				{
					name: "_cf-custom-hostname.validation.com",
					type: "TXT",
					value: "ownership-token",
				},
				{
					name: "_acme-challenge.www.validation.com",
					type: "TXT",
					value: "ssl-token",
				},
			],
			sslStatus: "pending_validation",
			status: "pending_validation",
		};

		await processor.process(job("domain-purchase", { domainId: row.id }));

		expect(provider.setDnsRecords).toHaveBeenNthCalledWith(
			2,
			"validation.com",
			[
				{
					name: "_cf-custom-hostname.validation.com",
					type: "TXT",
					value: "ownership-token",
				},
				{
					name: "_acme-challenge.www.validation.com",
					type: "TXT",
					value: "ssl-token",
				},
			],
		);
		expect(repository.rows.get(row.id)).toMatchObject({
			cfCustomHostnameId: "cf_validation",
			dns: {
				customHostnameDnsConfigured: true,
				purchaseDnsConfigured: true,
				records: expect.arrayContaining([
					{
						name: "_cf-custom-hostname.validation.com",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "ownership-token",
					},
					{
						name: "_acme-challenge.www.validation.com",
						purpose: "ownership_or_ssl_validation",
						type: "TXT",
						value: "ssl-token",
					},
				]),
			},
		});
	});

	it.each([
		{
			availability: {
				available: true,
				name: "missing-price.com",
			},
			name: "missing-price.com",
			reason: "missing wholesale price",
		},
		{
			availability: {
				available: true,
				name: "over-ceiling.com",
				wholesalePriceUsd: DOMAIN_TLD_CATALOG.com.wholesaleCeilingUsd + 0.01,
			},
			name: "over-ceiling.com",
			reason: "over-ceiling wholesale price",
		},
		{
			availability: {
				available: true,
				name: "premium.com",
				premium: true,
				wholesalePriceUsd: 1,
			},
			name: "premium.com",
			reason: "premium inventory",
		},
	])("fails closed for $reason", async ({ availability, name }) => {
		const { cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({ name, status: "registering" });
		provider.availability.set(name, availability);
		vi.spyOn(processorLogger(processor), "warn").mockImplementation(
			() => undefined,
		);

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{ attempts: 5, attemptsMade: 0 },
				),
			),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});

		expect(provider.register).not.toHaveBeenCalled();
		expect(cloudflare.createCustomHostname).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)).toMatchObject({
			error:
				"Domain price is premium, missing, or above the catalog safety ceiling",
			status: "failed",
		});
	});

	it("logs the pending payment-refund hook and marks pre-registration terminal failures", async () => {
		const { cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_cleanup",
			name: "taken.com",
			status: "registering",
		});
		provider.availability.set("taken.com", {
			available: false,
			name: "taken.com",
		});
		const loggerWarn = vi
			.spyOn(processorLogger(processor), "warn")
			.mockImplementation(() => undefined);
		const loggerError = vi
			.spyOn(processorLogger(processor), "error")
			.mockImplementation(() => undefined);

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{ attempts: 5, attemptsMade: 0 },
				),
			),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});

		expect(provider.register).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_cleanup");
		expect(loggerWarn).toHaveBeenCalledWith(
			"Domain registration failed before registrar purchase; payment refund hook is not connected",
			expect.stringContaining(`"domainId":"${row.id}"`),
		);
		expect(loggerError).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Domain is not available",
			status: "failed",
		});
	});

	it("rethrows transient registration failures while attempts remain", async () => {
		const { processor, provider, repository } = setup();
		const row = repository.seed({
			name: "transient.com",
			status: "registering",
		});
		provider.registerError = new Error("network timeout");
		const loggerWarn = vi
			.spyOn(processorLogger(processor), "warn")
			.mockImplementation(() => undefined);
		const loggerError = vi
			.spyOn(processorLogger(processor), "error")
			.mockImplementation(() => undefined);

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
		expect(repository.events).toEqual([]);
		expect(loggerWarn).not.toHaveBeenCalled();
		expect(loggerError).not.toHaveBeenCalled();
	});

	it("marks post-registration configuration failures for repair without logging a refund", async () => {
		const { cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({
			name: "repair.com",
			status: "registering",
		});
		provider.setDnsRecords.mockRejectedValueOnce(
			new Error("Name.com DNS update failed"),
		);
		const loggerWarn = vi
			.spyOn(processorLogger(processor), "warn")
			.mockImplementation(() => undefined);
		const loggerError = vi
			.spyOn(processorLogger(processor), "error")
			.mockImplementation(() => undefined);

		await expect(
			processor.process(job("domain-purchase", { domainId: row.id })),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});

		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Domain registration failed",
			providerDomainId: "namecom_registered",
			providerOrderId: "namecom_order_123",
			status: "failed",
		});
		expect(loggerError).toHaveBeenCalledWith(
			"Name.com registration succeeded but domain provisioning failed; manual repair required",
			expect.stringContaining('"providerOrderId":"namecom_order_123"'),
		);
		expect(loggerWarn).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).not.toHaveBeenCalled();
	});

	it("replays the stable key to recover a prior Name.com success without buying twice", async () => {
		const { processor, provider, repository } = setup();
		const row = repository.seed({
			name: "partial.com",
			status: "registering",
		});
		const transferLockExpiresAt = new Date("2026-10-01T00:00:00.000Z");
		provider.info.set("partial.com", {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			id: "namecom_existing",
			transferLockExpiresAt,
		});
		provider.registrationResult = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "namecom_existing",
			providerOrderId: "replayed_order",
			totalPaidUsd: 10.25,
			transferLockExpiresAt,
		};

		await processor.process(job("domain-purchase", { domainId: row.id }));
		await processor.process(job("domain-purchase", { domainId: row.id }));

		expect(provider.register).toHaveBeenCalledTimes(1);
		expect(provider.register).toHaveBeenCalledWith("partial.com", registrant, {
			idempotencyKey: `domain-purchase:${row.id}`,
			privacy: false,
			years: 1,
		});
		expect(provider.checkAvailability).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)).toMatchObject({
			providerDomainId: "namecom_existing",
			providerOrderId: "replayed_order",
			providerTotalPaidUsd: "10.25",
			status: "configuring",
			transferLockExpiresAt,
		});
	});

	it("re-enqueues configure jobs after transient Cloudflare failures", async () => {
		const { cloudflare, processor, queue, repository } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_1",
			name: "configure.com",
			providerDomainId: "namecom_configure",
			status: "configuring",
		});
		cloudflare.getCustomHostnameStatus.mockRejectedValueOnce(
			new Error("Cloudflare timeout"),
		);

		await expect(
			processor.process(
				job("domain-configure", {
					attempt: 2,
					domainId: row.id,
					nonce: "chain-1",
				}),
			),
		).resolves.toEqual({
			processed: false,
			reason: "transient_retry",
		});

		expect(queue.add).toHaveBeenCalledWith(
			"domain-configure",
			{ attempt: 3, domainId: row.id, nonce: "chain-1" },
			expect.objectContaining({
				delay: 120_000,
				jobId: `domain-configure:${row.id}:chain-1:3`,
			}),
		);
		expect(repository.rows.get(row.id)?.status).toBe("configuring");
	});

	it("activates a configured domain and publishes its routing pointer", async () => {
		const { cloudflare, processor, repository, routing } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_active",
			name: "active.com",
			providerDomainId: "namecom_active",
			status: "configuring",
		});
		cloudflare.statusResult = {
			hostnameStatus: "active",
			id: "cf_active",
			requiredRecords: [],
			sslStatus: "active",
			status: "active",
		};

		await expect(
			processor.process(
				job("domain-configure", {
					attempt: 1,
					domainId: row.id,
					nonce: "chain-active",
				}),
			),
		).resolves.toEqual({
			processed: true,
			status: "active",
		});

		expect(routing.putDomainPointer).toHaveBeenCalledWith("active.com", {
			projectId,
			source: "domain",
		});
		expect(repository.rows.get(row.id)).toMatchObject({
			error: null,
			status: "active",
		});
	});

	it("weekly sync reconciles Name.com state and marks missing domains transferred out", async () => {
		const { processor, provider, repository } = setup();
		const active = repository.seed({
			name: "synced.com",
			providerDomainId: "namecom_synced",
			status: "active",
		});
		const expired = repository.seed({
			name: "expired.com",
			providerDomainId: "namecom_expired",
			status: "active",
		});
		const missing = repository.seed({
			name: "missing.com",
			providerDomainId: "namecom_missing",
			status: "active",
		});
		repository.seed({
			name: "legacy-sync.com",
			provider: "openprovider",
			providerDomainId: "openprovider_legacy",
			status: "active",
		});
		const syncedExpiry = new Date("2028-01-01T00:00:00.000Z");
		const transferLockExpiresAt = new Date("2026-11-01T00:00:00.000Z");
		provider.info.set("synced.com", {
			expiresAt: syncedExpiry,
			id: "namecom_synced",
			status: "active",
			transferLockExpiresAt,
		});
		provider.info.set("expired.com", {
			expiresAt: new Date("2025-01-01T00:00:00.000Z"),
			id: "namecom_expired",
			status: "domain_expired",
		});

		await expect(processor.process(job("domain-sync", {}))).resolves.toEqual({
			processed: true,
			synced: 3,
		});

		expect(repository.rows.get(active.id)).toMatchObject({
			expiresAt: syncedExpiry,
			status: "active",
			transferLockExpiresAt,
		});
		expect(repository.rows.get(expired.id)?.status).toBe("expired");
		expect(repository.rows.get(missing.id)).toMatchObject({
			error: "Domain is no longer present in the Name.com account",
			isPrimary: false,
			status: "transferred_out",
		});
		expect(provider.getDomainInfo).not.toHaveBeenCalledWith("legacy-sync.com");
	});
});
