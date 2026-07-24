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
import type { OrderRefundQueueService } from "../../../server/src/modules/orders/application/services/order-refund-queue.service";
import type { PaymentOrdersRepository } from "../../../server/src/modules/orders/infrastructure/persistence/payment-orders.repository";
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

	async findByPaymentOrderIdForUpdate(paymentOrderId: string) {
		return (
			[...this.rows.values()].find(
				(row) => row.paymentOrderId === paymentOrderId,
			) ?? null
		);
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
		const row = await this.updateIfStatusOrNull(id, statuses, patch);

		if (!row) {
			throw new Error("Invalid status");
		}

		return row;
	}

	async updateIfStatusOrNull(
		id: string,
		statuses: DomainRow["status"][],
		patch: Partial<DomainRow>,
	) {
		const row = this.expect(id);

		if (!statuses.includes(row.status)) {
			return null;
		}

		if (patch.status === "failed") {
			this.events.push(
				`markFailed:${id}:${typeof patch.error === "string" ? patch.error : "Domain registration failed"}`,
			);
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
			paymentOrderId: null,
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

type FakePaymentOrder = {
	fulfillmentError: string | null;
	id: string;
	providerPaymentIntentId: string | null;
	refundStatus: string | null;
	status:
		| "pending"
		| "paid"
		| "fulfilling"
		| "failed"
		| "canceled"
		| "refunded"
		| "fulfilled";
};

class FakePaymentOrdersRepository {
	readonly rows = new Map<string, FakePaymentOrder>();

	constructor(private readonly events: string[]) {}

	seed(
		input: Pick<FakePaymentOrder, "id" | "providerPaymentIntentId"> &
			Partial<
				Pick<FakePaymentOrder, "fulfillmentError" | "refundStatus" | "status">
			>,
	) {
		const row = {
			fulfillmentError: null,
			refundStatus: null,
			status: "fulfilling",
			...input,
		} satisfies FakePaymentOrder;
		this.rows.set(row.id, row);

		return row;
	}

	async findById(id: string) {
		return this.rows.get(id) ?? null;
	}

	async withOrderFulfillmentFence<T>(
		id: string,
		operation: (order: FakePaymentOrder, tx: never) => Promise<T>,
	) {
		return operation(this.expect(id), {} as never);
	}

	async recordFinancialRaceNote(id: string, note: string) {
		const row = this.expect(id);

		if (row.status !== "failed" && row.status !== "refunded") {
			return null;
		}

		const noted = { ...row, fulfillmentError: note };
		this.rows.set(id, noted);
		this.events.push(`financialRace:${id}`);

		return noted;
	}

	async markFailed(id: string, error: string, _client?: unknown) {
		const row = this.expect(id);

		if (row.status !== "paid" && row.status !== "fulfilling") {
			return null;
		}

		const failed = {
			...row,
			fulfillmentError: error,
			status: "failed" as const,
		};
		this.rows.set(id, failed);
		this.events.push(`orderFailed:${id}:${error}`);

		return failed;
	}

	async markFulfilling(id: string) {
		const row = this.expect(id);

		if (row.status !== "paid") {
			return null;
		}

		const fulfilling = { ...row, status: "fulfilling" as const };
		this.rows.set(id, fulfilling);
		this.events.push(`orderFulfilling:${id}`);

		return fulfilling;
	}

	async markRefunded(id: string) {
		const row = this.expect(id);
		const refunded = { ...row, status: "refunded" as const };
		this.rows.set(id, refunded);
		this.events.push(`orderRefunded:${id}`);

		return refunded;
	}

	async markFulfilled(id: string) {
		const row = this.expect(id);

		if (row.status !== "fulfilling") {
			return null;
		}

		const fulfilled = {
			...row,
			fulfillmentError:
				row.refundStatus === "partial" ? row.fulfillmentError : null,
			status: "fulfilled" as const,
		};
		this.rows.set(id, fulfilled);
		this.events.push(`orderFulfilled:${id}`);

		return fulfilled;
	}

	private expect(id: string) {
		const row = this.rows.get(id);

		if (!row) {
			throw new Error(`Missing order ${id}`);
		}

		return row;
	}
}

class FakeOrderRefundQueue {
	constructor(private readonly events: string[]) {}

	enqueueFailures = 0;
	readonly enqueue = vi.fn(async (orderId: string, failureReason: string) => {
		if (this.enqueueFailures > 0) {
			this.enqueueFailures -= 1;
			throw new Error("refund queue unavailable");
		}

		this.events.push(`refundQueued:${orderId}:${failureReason}`);
	});
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
	const orders = new FakePaymentOrdersRepository(events);
	const refundQueue = new FakeOrderRefundQueue(events);
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
		orders as unknown as PaymentOrdersRepository,
		refundQueue as unknown as OrderRefundQueueService,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		queue as never,
	);

	return {
		cloudflare,
		credits,
		events,
		orders,
		processor,
		provider,
		queue,
		refundQueue,
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

	it("queues money refunds before terminalizing the domain and order", async () => {
		const {
			credits,
			events,
			orders,
			processor,
			provider,
			refundQueue,
			repository,
		} = setup();
		const orderId = "33333333-3333-4333-8333-333333333333";
		const paymentIntentId = "pi_domain_order";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: paymentIntentId,
			status: "paid",
		});
		const row = repository.seed({
			name: "money-failure.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		provider.availability = [{ available: false, name: "money-failure.com" }];

		await processor.process(
			job(
				"domain-purchase",
				{ domainId: row.id, orderId, paymentSource: "order" },
				{ attempts: 5 },
			),
		);

		expect(credits.grant).not.toHaveBeenCalled();
		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			orderId,
			"Domain registration failed",
		);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(events).toEqual([
			`orderFulfilling:${orderId}`,
			`refundQueued:${orderId}:Domain registration failed`,
			`markFailed:${row.id}:Domain registration failed`,
			`orderFailed:${orderId}:Domain registration failed`,
		]);
	});

	it("fences a stale purchase job when its money order was already refunded", async () => {
		const {
			cloudflare,
			credits,
			orders,
			processor,
			provider,
			queue,
			refundQueue,
			repository,
		} = setup();
		const orderId = "12121212-1212-4121-8121-121212121212";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_already_refunded",
			status: "refunded",
		});
		const row = repository.seed({
			cfCustomHostnameId: "cf_already_refunded",
			name: "already-refunded.com",
			paymentOrderId: orderId,
			status: "registering",
		});

		await expect(
			processor.process(
				job("domain-purchase", {
					domainId: row.id,
					orderId,
					paymentSource: "order",
				}),
			),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});

		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Domain registration failed",
			status: "failed",
		});
		expect(provider.availabilityNames).toEqual([]);
		expect(provider.registerCalls).toBe(0);
		expect(queue.add).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_already_refunded",
		);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
		expect(credits.grant).not.toHaveBeenCalled();
	});

	it("re-checks the locked order immediately before calling the registrar", async () => {
		const { orders, processor, provider, refundQueue, repository } = setup();
		const orderId = "14141414-1414-4141-8141-141414141414";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_fresh_fence",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "fresh-fence.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		const originalFence = orders.withOrderFulfillmentFence.bind(orders);
		vi.spyOn(orders, "withOrderFulfillmentFence").mockImplementationOnce(
			async (id, operation) => {
				const current = orders.rows.get(id);

				if (!current) {
					throw new Error(`Missing order ${id}`);
				}
				orders.rows.set(id, { ...current, status: "refunded" });

				return originalFence(id, operation);
			},
		);

		await expect(
			processor.process(
				job("domain-purchase", {
					domainId: row.id,
					orderId,
					paymentSource: "order",
				}),
			),
		).resolves.toEqual({
			processed: false,
			reason: "order_not_fulfillable",
		});

		expect(provider.registerCalls).toBe(0);
		expect(repository.rows.get(row.id)?.status).toBe("registering");
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
	});

	it("records manual review when a refund wins after registrar registration", async () => {
		const { orders, processor, provider, repository } = setup();
		const orderId = "15151515-1515-4151-8151-151515151515";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_registrar_race",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "registrar-race.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		const originalUpdate = repository.updateIfStatusOrNull.bind(repository);
		vi.spyOn(repository, "updateIfStatusOrNull").mockImplementationOnce(
			async (id, statuses, patch) => {
				if (patch.providerDomainId === "op_registered") {
					await repository.updateById(row.id, {
						error: "Payment was refunded",
						status: "failed",
					});
					const current = orders.rows.get(orderId);

					if (!current) {
						throw new Error(`Missing order ${orderId}`);
					}
					orders.rows.set(orderId, { ...current, status: "refunded" });

					return null;
				}

				return originalUpdate(id, statuses, patch);
			},
		);
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
				job("domain-purchase", {
					domainId: row.id,
					orderId,
					paymentSource: "order",
				}),
			),
		).resolves.toEqual({
			processed: false,
			reason: "financial_race",
		});

		expect(provider.registerCalls).toBe(1);
		expect(orders.rows.get(orderId)?.fulfillmentError).toContain(
			"was purchased at the registrar as op_registered",
		);
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
		expect(provider.setDnsRecordsMock).not.toHaveBeenCalled();
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining("MANUAL REVIEW REQUIRED"),
			expect.stringContaining(`"orderId":"${orderId}"`),
		);
		loggerError.mockRestore();
	});

	it("uses registering-state CAS writes for every post-registration mutation", async () => {
		const { orders, processor, repository } = setup();
		const orderId = "16161616-1616-4161-8161-161616161616";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_post_registration_cas",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "post-registration-cas.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		const cas = vi.spyOn(repository, "updateIfStatusOrNull");
		const setDns = vi.spyOn(repository, "setDns");

		await expect(
			processor.process(
				job("domain-purchase", {
					domainId: row.id,
					orderId,
					paymentSource: "order",
				}),
			),
		).resolves.toEqual({
			processed: true,
			status: "registering",
		});

		expect(cas).toHaveBeenCalledTimes(4);
		for (const call of cas.mock.calls) {
			expect(call[1]).toEqual(["registering"]);
		}
		expect(setDns).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.status).toBe("configuring");
	});

	it("cannot reactivate a refund-fenced configure job on replay", async () => {
		const {
			cloudflare,
			credits,
			orders,
			processor,
			refundQueue,
			repository,
			routing,
		} = setup();
		const orderId = "13131313-1313-4131-8131-131313131313";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_refund_fenced",
			status: "refunded",
		});
		const row = repository.seed({
			cfCustomHostnameId: "cf_refund_fenced",
			error: "Payment was refunded before domain fulfillment completed",
			name: "refund-fenced.com",
			paymentOrderId: orderId,
			status: "failed",
		});

		await expect(
			processor.process(
				job("domain-configure", {
					domainId: row.id,
					nonce: "refund-fenced",
				}),
			),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
		});

		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Payment was refunded before domain fulfillment completed",
			status: "failed",
		});
		expect(cloudflare.getCustomHostnameStatus).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_refund_fenced",
		);
		expect(routing.putDomainPointer).not.toHaveBeenCalled();
		expect(routing.deleteDomainPointer).toHaveBeenCalledWith(
			"refund-fenced.com",
		);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
		expect(credits.grant).not.toHaveBeenCalled();
	});

	it("deletes the custom hostname once when activation loses its CAS to a refund fence, including replay", async () => {
		const {
			cloudflare,
			credits,
			orders,
			processor,
			refundQueue,
			repository,
			routing,
		} = setup();
		const orderId = "17171717-1717-4171-8171-171717171717";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_configure_fence",
			status: "fulfilling",
		});
		const row = repository.seed({
			cfCustomHostnameId: "cf_configure_fence",
			name: "configure-fence.com",
			paymentOrderId: orderId,
			status: "configuring",
		});
		cloudflare.status = "active";
		vi.spyOn(repository, "updateIfStatusOrNull").mockImplementationOnce(
			async () => {
				await repository.updateById(row.id, {
					error: "Payment was refunded before domain fulfillment completed",
					status: "failed",
				});
				const current = orders.rows.get(orderId);

				if (!current) {
					throw new Error(`Missing order ${orderId}`);
				}
				orders.rows.set(orderId, { ...current, status: "refunded" });

				return null;
			},
		);
		const configureJob = job("domain-configure", {
			domainId: row.id,
			nonce: "configure-fence",
		});

		await expect(processor.process(configureJob)).resolves.toEqual({
			processed: false,
			reason: "state_changed",
		});
		await expect(processor.process(configureJob)).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
		});

		expect(repository.rows.get(row.id)).toMatchObject({
			cfCustomHostnameId: null,
			error: "Payment was refunded before domain fulfillment completed",
			status: "failed",
		});
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
		expect(cloudflare.getCustomHostnameStatus).toHaveBeenCalledTimes(1);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledTimes(1);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith(
			"cf_configure_fence",
		);
		expect(routing.putDomainPointer).toHaveBeenCalledTimes(1);
		expect(routing.deleteDomainPointer).toHaveBeenCalledTimes(2);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
		expect(credits.grant).not.toHaveBeenCalled();
	});

	it("does not terminalize money fulfillment until its durable refund is queued", async () => {
		const { credits, orders, processor, provider, refundQueue, repository } =
			setup();
		const orderId = "77777777-7777-4777-8777-777777777777";
		const paymentIntentId = "pi_refund_retry";
		orders.seed({ id: orderId, providerPaymentIntentId: paymentIntentId });
		const row = repository.seed({
			name: "refund-retry.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		provider.availability = [{ available: false, name: "refund-retry.com" }];
		refundQueue.enqueueFailures = 1;
		const purchaseJob = job(
			"domain-purchase",
			{ domainId: row.id, orderId, paymentSource: "order" },
			{ attempts: 5 },
		);

		await expect(processor.process(purchaseJob)).rejects.toThrow(
			"refund queue unavailable",
		);
		expect(orders.rows.get(orderId)?.status).toBe("fulfilling");
		expect(repository.rows.get(row.id)?.status).toBe("registering");

		await expect(processor.process(purchaseJob)).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});
		expect(refundQueue.enqueue).toHaveBeenCalledTimes(2);
		expect(refundQueue.enqueue).toHaveBeenLastCalledWith(
			orderId,
			"Domain registration failed",
		);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(credits.grant).not.toHaveBeenCalled();
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
		const nonce = `purchase-${row.id}`;
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
				jobId: `domain-configure-${row.id}-${nonce}-0`,
				removeOnComplete: 1000,
				removeOnFail: 5000,
			},
		);
		expect(queue.add).toHaveBeenCalledTimes(2);
	});

	it("replays the deterministic configure enqueue after a purchase queue failure", async () => {
		const { processor, queue, repository } = setup();
		const row = repository.seed({
			name: "queue-repair.com",
			status: "registering",
		});
		const purchaseJob = job(
			"domain-purchase",
			{ domainId: row.id },
			{ attempts: 5, id: `domain-purchase-${row.id}` },
		);
		queue.add.mockRejectedValueOnce(new Error("queue unavailable"));

		await expect(processor.process(purchaseJob)).rejects.toThrow(
			"queue unavailable",
		);
		expect(repository.rows.get(row.id)?.status).toBe("configuring");

		await expect(processor.process(purchaseJob)).resolves.toEqual({
			processed: false,
			reason: "configure_requeued",
		});
		expect(queue.add).toHaveBeenLastCalledWith(
			"domain-configure",
			{
				attempt: 0,
				domainId: row.id,
				nonce: `domain-purchase-${row.id}`,
			},
			expect.objectContaining({
				jobId: `domain-configure-${row.id}-domain-purchase-${row.id}-0`,
			}),
		);
	});

	it("terminally reimburses a purchase if configure enqueue exhausts retries", async () => {
		const { credits, processor, queue, repository } = setup();
		const row = repository.seed({
			name: "queue-exhausted.com",
			status: "registering",
		});
		queue.add.mockRejectedValue(new Error("queue unavailable"));

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{
						attempts: 5,
						attemptsMade: 0,
						id: `domain-purchase-${row.id}`,
					},
				),
			),
		).rejects.toThrow("queue unavailable");
		expect(repository.rows.get(row.id)?.status).toBe("configuring");

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{
						attempts: 5,
						attemptsMade: 4,
						id: `domain-purchase-${row.id}`,
					},
				),
			),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(credits.grant).toHaveBeenCalledWith(
			userId,
			DOMAIN_TLD_CATALOG.com.registrationCredits,
			expect.objectContaining({
				idempotencyKey: `domain-refund:${row.id}`,
			}),
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
				jobId: `domain-configure-${row.id}-chain-1-3`,
				removeOnComplete: 1000,
				removeOnFail: 5000,
			}),
		);
	});

	it("queues a money refund when configure enqueue exhausts BullMQ retries", async () => {
		const { credits, orders, processor, queue, refundQueue, repository } =
			setup();
		const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
		const paymentIntentId = "pi_config_queue_exhausted";
		orders.seed({ id: orderId, providerPaymentIntentId: paymentIntentId });
		const row = repository.seed({
			cfCustomHostnameId: "cf_config_queue_exhausted",
			name: "config-queue-exhausted.com",
			paymentOrderId: orderId,
			status: "configuring",
		});
		queue.add.mockRejectedValue(new Error("queue unavailable"));

		await expect(
			processor.process(
				job(
					"domain-configure",
					{
						attempt: 2,
						domainId: row.id,
						nonce: "queue-exhausted",
					},
					{ attempts: 3, attemptsMade: 2 },
				),
			),
		).resolves.toEqual({
			processed: false,
			reason: "terminal_failure",
		});

		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			orderId,
			"Domain registration failed",
		);
		expect(credits.grant).not.toHaveBeenCalled();
	});

	it("queues a money refund when domain configuration times out", async () => {
		const { credits, orders, processor, refundQueue, repository } = setup();
		const orderId = "44444444-4444-4444-8444-444444444444";
		const paymentIntentId = "pi_config_timeout";
		orders.seed({ id: orderId, providerPaymentIntentId: paymentIntentId });
		const row = repository.seed({
			cfCustomHostnameId: "cf_timeout",
			name: "config-timeout.com",
			paymentOrderId: orderId,
			status: "configuring",
		});

		await processor.process(
			job("domain-configure", {
				attempt: 100,
				domainId: row.id,
				nonce: "money-timeout",
			}),
		);

		expect(credits.grant).not.toHaveBeenCalled();
		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			orderId,
			"Domain registration failed",
		);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
	});

	it("keeps configure state retryable until the durable refund enqueue succeeds", async () => {
		const { orders, processor, refundQueue, repository } = setup();
		const orderId = "88888888-8888-4888-8888-888888888888";
		const paymentIntentId = "pi_config_refund_retry";
		orders.seed({ id: orderId, providerPaymentIntentId: paymentIntentId });
		const row = repository.seed({
			cfCustomHostnameId: "cf_refund_retry",
			name: "config-refund-retry.com",
			paymentOrderId: orderId,
			status: "configuring",
		});
		const configureJob = job("domain-configure", {
			attempt: 100,
			domainId: row.id,
			nonce: "refund-retry",
		});
		refundQueue.enqueueFailures = 1;

		await expect(processor.process(configureJob)).rejects.toThrow(
			"refund queue unavailable",
		);
		expect(repository.rows.get(row.id)?.status).toBe("configuring");
		expect(orders.rows.get(orderId)?.status).toBe("fulfilling");

		await expect(processor.process(configureJob)).resolves.toEqual({
			processed: false,
			reason: "timed_out",
		});
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(refundQueue.enqueue).toHaveBeenCalledTimes(2);
	});

	it("does not refund when a stale configure timeout loses the activation CAS", async () => {
		const { orders, processor, refundQueue, repository } = setup();
		const orderId = "99999999-9999-4999-8999-999999999999";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_stale_timeout",
		});
		const row = repository.seed({
			cfCustomHostnameId: "cf_stale_timeout",
			name: "stale-timeout.com",
			paymentOrderId: orderId,
			status: "configuring",
		});
		const originalFence = orders.withOrderFulfillmentFence.bind(orders);
		vi.spyOn(orders, "withOrderFulfillmentFence").mockImplementationOnce(
			async (id, operation) => {
				await repository.updateById(row.id, {
					error: null,
					status: "active",
				});

				return originalFence(id, operation);
			},
		);

		await processor.process(
			job("domain-configure", {
				attempt: 100,
				domainId: row.id,
				nonce: "stale-timeout",
			}),
		);

		expect(repository.rows.get(row.id)?.status).toBe("active");
		expect(orders.rows.get(orderId)?.status).toBe("fulfilled");
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
	});

	it("activates and fulfills an unattached money order without refunding it", async () => {
		const {
			cloudflare,
			credits,
			orders,
			processor,
			refundQueue,
			repository,
			routing,
		} = setup();
		const orderId = "55555555-5555-4555-8555-555555555555";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_unattached_order",
		});
		const row = repository.seed({
			cfCustomHostnameId: "cf_unattached",
			name: "unattached.com",
			paymentOrderId: orderId,
			projectId: null,
			status: "configuring",
		});
		cloudflare.status = "active";

		await expect(
			processor.process(
				job("domain-configure", {
					domainId: row.id,
					nonce: "unattached-order",
				}),
			),
		).resolves.toEqual({ processed: true, status: "active" });

		expect(repository.rows.get(row.id)?.status).toBe("active");
		expect(orders.rows.get(orderId)?.status).toBe("fulfilled");
		expect(routing.putDomainPointer).not.toHaveBeenCalled();
		expect(cloudflare.deleteCustomHostname).not.toHaveBeenCalled();
		expect(credits.grant).not.toHaveBeenCalled();
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
	});

	it("heals a missed order completion when an active domain job is replayed", async () => {
		const { orders, processor, repository } = setup();
		const orderId = "66666666-6666-4666-8666-666666666666";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_active_replay",
		});
		const row = repository.seed({
			name: "active-replay.com",
			paymentOrderId: orderId,
			status: "active",
		});

		await expect(
			processor.process(job("domain-configure", { domainId: row.id })),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
		});

		expect(orders.rows.get(orderId)?.status).toBe("fulfilled");
	});

	it("preserves a partial-refund manual-review note when fulfillment completes", async () => {
		const { orders, processor, repository } = setup();
		const orderId = "12121212-1212-4212-8212-121212121212";
		const manualReviewNote =
			"Manual review required: Stripe reported a partial refund for this domain order; fulfillment was intentionally left unchanged.";
		orders.seed({
			fulfillmentError: manualReviewNote,
			id: orderId,
			providerPaymentIntentId: "pi_partial_then_fulfilled",
			refundStatus: "partial",
		});
		const row = repository.seed({
			name: "partial-then-fulfilled.com",
			paymentOrderId: orderId,
			status: "active",
		});

		await expect(
			processor.process(job("domain-configure", { domainId: row.id })),
		).resolves.toEqual({
			processed: false,
			reason: "not_configuring",
		});

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: manualReviewNote,
			refundStatus: "partial",
			status: "fulfilled",
		});
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
