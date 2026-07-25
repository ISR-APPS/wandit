import { DOMAIN_TLD_CATALOG, type Registrant } from "@wandit/contracts";
import type {
	DomainConfigureJobData,
	DomainJobName,
	DomainPurchaseJobData,
} from "@wandit/jobs";
import { describe, expect, it, vi } from "vitest";

import { DomainProviderError } from "../../../server/src/modules/domains/domain/errors/domain.errors";
import type {
	DomainAvailability,
	DomainDnsRecord,
	DomainProvider,
	DomainProviderInfo,
	DomainRegistrationOptions,
	DomainRegistrationResult,
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

	async findExpiringPurchased(now = new Date()) {
		const expiringBy = new Date(now);
		expiringBy.setUTCDate(expiringBy.getUTCDate() + 30);

		return [...this.rows.values()]
			.filter(
				(row) =>
					row.source === "purchased" &&
					(row.status === "active" || row.status === "expired") &&
					row.expiresAt !== null &&
					row.expiresAt <= expiringBy,
			)
			.sort((left, right) => {
				const byExpiry =
					(left.expiresAt?.getTime() ?? 0) - (right.expiresAt?.getTime() ?? 0);

				return byExpiry || left.id.localeCompare(right.id);
			});
	}

	async recordRenewalNotice(id: string, message: string) {
		this.events.push(`renewalNotice:${id}`);

		return this.updateById(id, { error: message });
	}

	async findPurchasedForSync() {
		return [...this.rows.values()].filter(
			(row) =>
				row.source === "purchased" &&
				row.provider === "namecom" &&
				row.providerDomainId,
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
			paymentOrderId: null,
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
	availability: DomainAvailability[] = [];
	availabilityNames: string[][] = [];
	info: DomainProviderInfo | null = null;
	readonly infoByName = new Map<string, DomainProviderInfo | null | Error>();
	registerCalls = 0;
	registerError: Error | null = null;
	registerResult: DomainRegistrationResult = {
		expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		providerDomainId: "nc_registered",
	};
	readonly registerOptions: DomainRegistrationOptions[] = [];
	renewCalls = 0;
	readonly setDnsRecordsMock = vi.fn(
		async (_name: string, _records: DomainDnsRecord[]) => undefined,
	);
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

	async register(
		_name: string,
		_registrant: Registrant,
		options: DomainRegistrationOptions,
	) {
		this.registerCalls += 1;
		this.registerOptions.push(options);

		if (this.registerError) {
			throw this.registerError;
		}

		return this.registerResult;
	}

	async renew() {
		this.renewCalls += 1;

		return { expiresAt: new Date("2028-01-01T00:00:00.000Z") };
	}

	async setDnsRecords(name: string, records: DomainDnsRecord[]) {
		return this.setDnsRecordsMock(name, records);
	}

	async setUrlForwarding() {
		return this.setUrlForwardingMock();
	}

	async getAuthCode() {
		return "AUTH";
	}

	async setTransferLock() {}

	async getDomainInfo(name: string) {
		if (this.infoByName.has(name)) {
			const entry = this.infoByName.get(name);

			if (entry instanceof Error) {
				throw entry;
			}

			return entry ?? null;
		}

		return this.info;
	}
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
	requiredRecords: Array<{ name: string; type: "TXT"; value: string }> = [];
	readonly createCustomHostname = vi.fn(async () => ({
		hostnameStatus: "pending",
		id: "cf_1",
		requiredRecords: this.requiredRecords,
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

class FakeRoutingService {
	readonly putDomainPointer = vi.fn(async () => undefined);
	readonly deleteDomainPointer = vi.fn(async () => undefined);
	readonly refreshProjectDomains = vi.fn(async () => undefined);
}

function setup() {
	const events: string[] = [];
	const repository = new FakeDomainsRepository(events);
	const provider = new FakeProvider();
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
		orders as unknown as PaymentOrdersRepository,
		refundQueue as unknown as OrderRefundQueueService,
		cloudflare as unknown as CustomHostnameService,
		routing as unknown as DomainRoutingService,
		queue as never,
	);

	return {
		cloudflare,
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
		noticed: number;
		processed: boolean;
	}>;
	processDomainSync(): Promise<{
		failed: number;
		processed: boolean;
		synced: number;
	}>;
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
	it("registers both the renewal-notice and weekly sync schedulers", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"domain-renewals-daily",
			{ pattern: "0 2 * * *" },
			expect.objectContaining({ name: "domain-renewals" }),
		);
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"domain-sync-weekly",
			{ pattern: "0 3 * * 0" },
			expect.objectContaining({ name: "domain-sync" }),
		);
	});

	it("re-checks real-domain availability and terminally fails over-ceiling purchases", async () => {
		const { cloudflare, events, processor, provider, refundQueue, repository } =
			setup();
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

		expect(provider.availabilityNames).toEqual([["premium.com"]]);
		expect(provider.registerCalls).toBe(0);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.error).toBe(
			"Domain price is premium, missing, or above the catalog safety ceiling",
		);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
		expect(events.some((event) => event.startsWith("markFailed"))).toBe(true);
		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_cleanup");
	});

	it("fails closed when the registrar quote is missing entirely", async () => {
		const { processor, provider, repository } = setup();
		const row = repository.seed({
			name: "no-quote.com",
			status: "registering",
		});
		provider.availability = [{ available: true, name: "no-quote.com" }];

		await processor.process(
			job("domain-purchase", { domainId: row.id }, { attempts: 5 }),
		);

		expect(provider.registerCalls).toBe(0);
		expect(repository.rows.get(row.id)?.status).toBe("failed");
	});

	it("rethrows transient purchase failures while attempts remain without marking failed", async () => {
		const { events, processor, provider, repository } = setup();
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
		expect(events.some((event) => event.startsWith("markFailed"))).toBe(false);
	});

	it("treats a non-retryable registrar error as terminal on the first attempt and refunds inside the fence", async () => {
		const { events, orders, processor, provider, refundQueue, repository } =
			setup();
		const orderId = "20202020-2020-4020-8020-202020202020";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_nonretryable",
			status: "paid",
		});
		const row = repository.seed({
			name: "rejected.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		provider.registerError = new DomainProviderError(
			"Registrar rejected request",
			{ retryable: false, upstreamStatus: 400 },
		);

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id, orderId, paymentSource: "order" },
					{ attempts: 5, attemptsMade: 0 },
				),
			),
		).resolves.toEqual({ processed: false, reason: "terminal_failure" });

		expect(refundQueue.enqueue).toHaveBeenCalledTimes(1);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(events).toEqual([
			`orderFulfilling:${orderId}`,
			`refundQueued:${orderId}:Registrar rejected request`,
			`markFailed:${row.id}:Registrar rejected request`,
			`orderFailed:${orderId}:Registrar rejected request`,
		]);
	});

	it("retries a retryable registrar error instead of terminalizing", async () => {
		const { processor, provider, refundQueue, repository } = setup();
		const row = repository.seed({
			name: "retryable.com",
			status: "registering",
		});
		provider.registerError = new DomainProviderError("Registrar 502", {
			retryable: true,
			upstreamStatus: 502,
		});

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id },
					{ attempts: 5, attemptsMade: 0 },
				),
			),
		).rejects.toThrow("Registrar 502");

		expect(repository.rows.get(row.id)?.status).toBe("registering");
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
	});

	it("queues money refunds before terminalizing the domain and order", async () => {
		const { events, orders, processor, provider, refundQueue, repository } =
			setup();
		const orderId = "33333333-3333-4333-8333-333333333333";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_domain_order",
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

		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			orderId,
			"Domain is not available",
		);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(events).toEqual([
			`orderFulfilling:${orderId}`,
			`refundQueued:${orderId}:Domain is not available`,
			`markFailed:${row.id}:Domain is not available`,
			`orderFailed:${orderId}:Domain is not available`,
		]);
	});

	it("terminally fails a job whose order id does not match the domain row and still refunds the row's order", async () => {
		const { events, orders, processor, provider, refundQueue, repository } =
			setup();
		const rowOrderId = "21212121-2121-4121-8121-212121212121";
		const bogusOrderId = "31313131-3131-4131-8131-313131313131";
		orders.seed({
			id: rowOrderId,
			providerPaymentIntentId: "pi_row_order",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "mismatch.com",
			paymentOrderId: rowOrderId,
			status: "registering",
		});

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id, orderId: bogusOrderId, paymentSource: "order" },
					{ attempts: 5 },
				),
			),
		).resolves.toEqual({ processed: false, reason: "terminal_failure" });

		expect(provider.registerCalls).toBe(0);
		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			rowOrderId,
			"Domain registration failed",
		);
		expect(orders.rows.get(rowOrderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(events).toEqual([
			`refundQueued:${rowOrderId}:Domain registration failed`,
			`markFailed:${row.id}:Domain registration failed`,
			`orderFailed:${rowOrderId}:Domain registration failed`,
		]);
	});

	it("terminally fails without retry when the referenced payment order does not exist", async () => {
		const { events, processor, provider, refundQueue, repository } = setup();
		const missingOrderId = "41414141-4141-4141-8141-414141414141";
		const row = repository.seed({
			name: "orphan-order.com",
			paymentOrderId: missingOrderId,
			status: "registering",
		});

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id, orderId: missingOrderId, paymentSource: "order" },
					{ attempts: 5 },
				),
			),
		).resolves.toEqual({ processed: false, reason: "terminal_failure" });

		expect(provider.registerCalls).toBe(0);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(events).toEqual([
			`markFailed:${row.id}:Payment order is missing for this domain purchase`,
		]);
	});

	it("routes unsupported legacy registrar rows through the terminal path so their order refunds", async () => {
		const { orders, processor, provider, refundQueue, repository } = setup();
		const orderId = "23232323-2323-4323-8323-232323232323";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_legacy_provider",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "legacy.com",
			paymentOrderId: orderId,
			provider: "openprovider",
			status: "registering",
		});

		await expect(
			processor.process(
				job(
					"domain-purchase",
					{ domainId: row.id, orderId, paymentSource: "order" },
					{ attempts: 5 },
				),
			),
		).resolves.toEqual({ processed: false, reason: "terminal_failure" });

		expect(provider.registerCalls).toBe(0);
		expect(refundQueue.enqueue).toHaveBeenCalledWith(
			orderId,
			"Unsupported registrar for this worker",
		);
		expect(repository.rows.get(row.id)).toMatchObject({
			error: "Unsupported registrar for this worker",
			status: "failed",
		});
	});

	it("fences a stale purchase job when its money order was already refunded", async () => {
		const {
			cloudflare,
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

	it("passes the stable registration idempotency key and stores the registrar receipt", async () => {
		const { orders, processor, provider, repository } = setup();
		const orderId = "24242424-2424-4424-8424-242424242424";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_receipt",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "receipt.com",
			paymentOrderId: orderId,
			status: "registering",
		});
		provider.registerResult = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "receipt.com",
			providerOrderId: "1234",
			totalPaidUsd: 12.99,
			transferLockExpiresAt: new Date("2026-09-22T00:00:00.000Z"),
		};

		await expect(
			processor.process(
				job("domain-purchase", {
					domainId: row.id,
					orderId,
					paymentSource: "order",
				}),
			),
		).resolves.toEqual({ processed: true, status: "registering" });

		expect(provider.registerCalls).toBe(1);
		expect(provider.registerOptions).toEqual([
			{
				idempotencyKey: `domain-purchase:${row.id}`,
				privacy: false,
				years: 1,
			},
		]);
		expect(repository.rows.get(row.id)).toMatchObject({
			providerDomainId: "receipt.com",
			providerOrderId: "1234",
			providerTotalPaidUsd: "12.99",
			status: "configuring",
			transferLockExpiresAt: new Date("2026-09-22T00:00:00.000Z"),
		});
	});

	it("replays the stable key to recover a prior registrar success without buying twice", async () => {
		const { processor, provider, queue, repository } = setup();
		const row = repository.seed({
			name: "partial.com",
			status: "registering",
		});
		const nonce = `purchase-${row.id}`;
		// The name exists in our account (lost receipt); availability would say
		// "taken", so the gate must be skipped and the idempotent create replayed.
		provider.infoByName.set("partial.com", {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			id: "partial.com",
		});
		provider.registerResult = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "partial.com",
		};

		await processor.process(job("domain-purchase", { domainId: row.id }));
		await processor.process(job("domain-purchase", { domainId: row.id }));

		expect(provider.availabilityNames).toEqual([]);
		expect(provider.registerCalls).toBe(1);
		expect(provider.registerOptions[0]?.idempotencyKey).toBe(
			`domain-purchase:${row.id}`,
		);
		expect(repository.rows.get(row.id)?.providerDomainId).toBe("partial.com");
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
		provider.registerResult = {
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
			providerDomainId: "nc_registered",
		};
		const originalUpdate = repository.updateIfStatusOrNull.bind(repository);
		vi.spyOn(repository, "updateIfStatusOrNull").mockImplementationOnce(
			async (id, statuses, patch) => {
				if (patch.providerDomainId === "nc_registered") {
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
			"was purchased at the registrar as nc_registered",
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

		expect(cas).toHaveBeenCalledTimes(5);
		for (const call of cas.mock.calls) {
			expect(call[1]).toEqual(["registering"]);
		}
		expect(setDns).not.toHaveBeenCalled();
		expect(repository.rows.get(row.id)?.status).toBe("configuring");
	});

	it("persists Cloudflare validation records and pushes them to the registrar before SSL polling", async () => {
		const { cloudflare, processor, provider, repository } = setup();
		const orderRow = repository.seed({
			name: "ssl-fix.com",
			status: "registering",
		});
		cloudflare.requiredRecords = [
			{
				name: "_cf-custom-hostname.ssl-fix.com",
				type: "TXT",
				value: "validation-token",
			},
		];

		await expect(
			processor.process(job("domain-purchase", { domainId: orderRow.id })),
		).resolves.toEqual({ processed: true, status: "registering" });

		// First call is the www CNAME, second is the CF validation push.
		expect(provider.setDnsRecordsMock).toHaveBeenCalledTimes(2);
		expect(provider.setDnsRecordsMock).toHaveBeenLastCalledWith("ssl-fix.com", [
			{
				name: "_cf-custom-hostname.ssl-fix.com",
				type: "TXT",
				value: "validation-token",
			},
		]);
		const dns = repository.rows.get(orderRow.id)?.dns as {
			customHostnameDnsConfigured?: boolean;
			records?: Array<{ name: string; value: string }>;
		};
		expect(dns.customHostnameDnsConfigured).toBe(true);
		expect(
			dns.records?.some((record) => record.value === "validation-token"),
		).toBe(true);
	});

	it("back-fills validation records for older rows that only carry the Cloudflare id", async () => {
		const { cloudflare, processor, provider, repository } = setup();
		const row = repository.seed({
			cfCustomHostnameId: "cf_backfill",
			dns: {
				purchaseDnsConfigured: true,
				records: [
					{
						name: "www",
						purpose: "traffic",
						type: "CNAME",
						value: "customers.wandit.app",
					},
				],
			},
			name: "backfill.com",
			providerDomainId: "backfill.com",
			status: "registering",
		});
		cloudflare.requiredRecords = [
			{ name: "_cf.backfill.com", type: "TXT", value: "backfill-token" },
		];

		await expect(
			processor.process(job("domain-purchase", { domainId: row.id })),
		).resolves.toEqual({ processed: true, status: "registering" });

		expect(cloudflare.createCustomHostname).not.toHaveBeenCalled();
		expect(cloudflare.getCustomHostnameStatus).toHaveBeenCalledWith(
			"cf_backfill",
		);
		expect(provider.setDnsRecordsMock).toHaveBeenCalledWith("backfill.com", [
			{ name: "_cf.backfill.com", type: "TXT", value: "backfill-token" },
		]);
	});

	it("deletes an unclaimed Cloudflare hostname when persisting its id loses the CAS", async () => {
		const { cloudflare, orders, processor, repository } = setup();
		const orderId = "25252525-2525-4525-8525-252525252525";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_unclaimed_cf",
			status: "fulfilling",
		});
		const row = repository.seed({
			name: "unclaimed-cf.com",
			paymentOrderId: orderId,
			providerDomainId: "unclaimed-cf.com",
			status: "registering",
		});
		const originalUpdate = repository.updateIfStatusOrNull.bind(repository);
		vi.spyOn(repository, "updateIfStatusOrNull").mockImplementation(
			async (id, statuses, patch) => {
				if (patch.cfCustomHostnameId === "cf_1") {
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
		).resolves.toEqual({ processed: false, reason: "financial_race" });

		expect(cloudflare.deleteCustomHostname).toHaveBeenCalledWith("cf_1");
		loggerError.mockRestore();
	});

	it("cannot reactivate a refund-fenced configure job on replay", async () => {
		const { cloudflare, orders, processor, refundQueue, repository, routing } =
			setup();
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
	});

	it("deletes the custom hostname once when activation loses its CAS to a refund fence, including replay", async () => {
		const { cloudflare, orders, processor, refundQueue, repository, routing } =
			setup();
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
	});

	it("does not terminalize money fulfillment until its durable refund is queued", async () => {
		const { orders, processor, provider, refundQueue, repository } = setup();
		const orderId = "77777777-7777-4777-8777-777777777777";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_refund_retry",
		});
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
			"Domain is not available",
		);
		expect(orders.rows.get(orderId)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.status).toBe("failed");
	});

	it("exhausted transient purchase attempts fail with a generic stored failure summary", async () => {
		const { processor, provider, refundQueue, repository } = setup();
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

		expect(repository.rows.get(row.id)?.status).toBe("failed");
		expect(repository.rows.get(row.id)?.error).toBe(
			"Domain registration failed",
		);
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
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

	it("terminally fails a purchase if configure enqueue exhausts retries", async () => {
		const { processor, queue, refundQueue, repository } = setup();
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
		expect(refundQueue.enqueue).not.toHaveBeenCalled();
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
		const { orders, processor, queue, refundQueue, repository } = setup();
		const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_config_queue_exhausted",
		});
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
	});

	it("queues a money refund when domain configuration times out", async () => {
		const { orders, processor, refundQueue, repository } = setup();
		const orderId = "44444444-4444-4444-8444-444444444444";
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_config_timeout",
		});
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
		orders.seed({
			id: orderId,
			providerPaymentIntentId: "pi_config_refund_retry",
		});
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
		const { cloudflare, orders, processor, refundQueue, repository, routing } =
			setup();
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

	it("records expiry notices inside the 30-day window without renewing or charging", async () => {
		const { events, processor, provider, repository } = setup();
		const now = new Date("2027-01-01T00:00:00.000Z");
		const due = repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "expiring.com",
			providerDomainId: "expiring.com",
			status: "active",
		});
		const alreadyExpired = repository.seed({
			expiresAt: new Date(now.getTime() - 2 * dayMs),
			name: "already-expired.com",
			providerDomainId: "already-expired.com",
			status: "expired",
		});
		repository.seed({
			expiresAt: new Date(now.getTime() + 60 * dayMs),
			name: "too-early.com",
			providerDomainId: "too-early.com",
			status: "active",
		});
		repository.seed({
			expiresAt: new Date(now.getTime() + 20 * dayMs),
			name: "failed.com",
			providerDomainId: "failed.com",
			status: "failed",
		});

		const result = await (
			processor as unknown as ProcessorInternals
		).processDomainRenewals(now);

		expect(result).toEqual({ noticed: 2, processed: true });
		expect(provider.renewCalls).toBe(0);
		expect(repository.rows.get(due.id)?.error).toContain(
			"automatic renewal is not available yet",
		);
		expect(repository.rows.get(alreadyExpired.id)?.error).toContain(
			"expires in 0 day(s)",
		);
		expect(
			events.filter((event) => event.startsWith("renewalNotice")).length,
		).toBe(2);
	});

	it("notices expiring domains even when auto-renew was never enabled", async () => {
		const { processor, provider, repository } = setup();
		const now = new Date("2027-01-01T00:00:00.000Z");
		const row = repository.seed({
			autoRenew: false,
			expiresAt: new Date(now.getTime() + 10 * dayMs),
			name: "no-autorenew.com",
			providerDomainId: "no-autorenew.com",
			status: "active",
		});

		const result = await (
			processor as unknown as ProcessorInternals
		).processDomainRenewals(now);

		expect(result).toEqual({ noticed: 1, processed: true });
		expect(provider.renewCalls).toBe(0);
		expect(repository.rows.get(row.id)?.error).toContain("expires in 10");
	});

	it("weekly sync reconciles registrar state and marks vanished domains transferred out", async () => {
		const { processor, provider, repository } = setup();
		const lockDate = new Date("2026-09-22T00:00:00.000Z");
		const active = repository.seed({
			expiresAt: new Date("2026-06-01T00:00:00.000Z"),
			isPrimary: true,
			name: "synced.com",
			providerDomainId: "synced.com",
			status: "active",
		});
		const vanished = repository.seed({
			isPrimary: true,
			name: "vanished.com",
			providerDomainId: "vanished.com",
			status: "active",
		});
		repository.seed({
			name: "legacy-op.com",
			provider: "openprovider",
			providerDomainId: "op_1",
			status: "active",
		});
		provider.infoByName.set("synced.com", {
			expiresAt: new Date("2027-06-01T00:00:00.000Z"),
			id: "synced.com",
			status: "active",
			transferLockExpiresAt: lockDate,
		});
		provider.infoByName.set("vanished.com", null);

		const result = await (
			processor as unknown as ProcessorInternals
		).processDomainSync();

		expect(result).toEqual({ failed: 0, processed: true, synced: 2 });
		expect(repository.rows.get(active.id)).toMatchObject({
			expiresAt: new Date("2027-06-01T00:00:00.000Z"),
			status: "active",
			transferLockExpiresAt: lockDate,
		});
		expect(repository.rows.get(vanished.id)).toMatchObject({
			error: "Domain is no longer present in the registrar account",
			isPrimary: false,
			status: "transferred_out",
		});
	});

	it("isolates per-row sync failures so one bad row does not abort the sweep", async () => {
		const { processor, provider, repository } = setup();
		const broken = repository.seed({
			name: "broken.com",
			providerDomainId: "broken.com",
			status: "active",
		});
		const healthy = repository.seed({
			name: "healthy.com",
			providerDomainId: "healthy.com",
			status: "active",
		});
		provider.infoByName.set("broken.com", new Error("registrar 500"));
		provider.infoByName.set("healthy.com", {
			expiresAt: new Date("2027-06-01T00:00:00.000Z"),
			id: "healthy.com",
			status: "active",
			transferLockExpiresAt: null,
		});
		const loggerWarn = vi
			.spyOn(
				(
					processor as unknown as {
						logger: { warn: (...args: unknown[]) => void };
					}
				).logger,
				"warn",
			)
			.mockImplementation(() => undefined);

		const result = await (
			processor as unknown as ProcessorInternals
		).processDomainSync();

		expect(result).toEqual({ failed: 1, processed: true, synced: 1 });
		expect(repository.rows.get(broken.id)?.status).toBe("active");
		expect(repository.rows.get(healthy.id)?.expiresAt).toEqual(
			new Date("2027-06-01T00:00:00.000Z"),
		);
		expect(loggerWarn).toHaveBeenCalledWith(
			expect.stringContaining(`Domain sync failed for ${broken.id}`),
			"registrar 500",
		);
		loggerWarn.mockRestore();
	});
});
