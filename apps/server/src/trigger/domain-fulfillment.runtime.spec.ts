import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
	apexZoneSteps: [] as unknown[][],
	captureException: vi.fn(),
	recoverConfiguration: vi.fn(async () => ({ id: "run_configuration" })),
	recoverPurchase: vi.fn(async () => ({ id: "run_purchase" })),
	terminalDependencies: null as unknown,
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: { captureException: runtimeMocks.captureException },
}));

vi.mock(
	"../modules/domains/infrastructure/trigger/trigger-domain-task-dispatcher.service",
	() => ({
		recoverDomainConfigurationTask: runtimeMocks.recoverConfiguration,
		recoverDomainPurchaseTask: runtimeMocks.recoverPurchase,
	}),
);

// Real step, but every composition's constructor arguments are captured so the
// per-runtime wiring (sources, registrar, options) can be asserted.
vi.mock(
	"../modules/domains/application/fulfillment/apex-zone.step",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("../modules/domains/application/fulfillment/apex-zone.step")
			>();

		return {
			ApexZoneStep: class extends actual.ApexZoneStep {
				constructor(
					...args: ConstructorParameters<typeof actual.ApexZoneStep>
				) {
					super(...args);
					runtimeMocks.apexZoneSteps.push(args);
				}
			},
		};
	},
);

vi.mock(
	"../modules/domains/application/fulfillment/domain-terminal-failure.step",
	() => ({
		DomainTerminalFailureStep: class {
			constructor(dependencies: unknown) {
				runtimeMocks.terminalDependencies = dependencies;
			}

			execute = vi.fn(async () => ({ status: "failed" as const }));
		},
	}),
);

import type { DomainTerminalFailureErrorTags } from "../modules/domains/application/fulfillment/domain-terminal-failure.step";
import { NamecomProvider } from "../modules/domains/infrastructure/namecom/namecom.provider";
import { DomainsRepository } from "../modules/domains/infrastructure/persistence/domains.repository";
import {
	createDomainApexBackfillRuntime,
	createDomainConfigurationRuntime,
	createDomainFailureRuntime,
	createDomainPurchaseRuntime,
	createDomainReconciliationRuntime,
} from "./domain-fulfillment.runtime";

type CapturedApexZoneStep = {
	options: {
		enabled: boolean;
		fallbackOrigin: string;
		sources: readonly string[];
	};
	registrar: {
		setNameservers(name: string, nameservers: string[]): Promise<void>;
	};
};

function lastApexZoneStep(): CapturedApexZoneStep {
	const args = runtimeMocks.apexZoneSteps.at(-1);

	if (!args) {
		throw new Error("Expected an ApexZoneStep composition");
	}

	return {
		options: args[5] as CapturedApexZoneStep["options"],
		registrar: args[2] as CapturedApexZoneStep["registrar"],
	};
}

describe("createDomainFailureRuntime", () => {
	afterEach(() => {
		vi.clearAllMocks();
		runtimeMocks.terminalDependencies = null;
	});

	it("wires terminal error reporting to the initialized node client", () => {
		createDomainFailureRuntime(databaseStub(), {
			error: vi.fn(),
			warn: vi.fn(),
		});
		const dependencies = runtimeMocks.terminalDependencies as {
			reportError(error: unknown, tags: DomainTerminalFailureErrorTags): void;
		};
		const originalError = new Error("provider response with private details");
		const tags = {
			domainId: "11111111-1111-4111-8111-111111111111",
			orderId: "22222222-2222-4222-8222-222222222222",
		};

		dependencies.reportError(originalError, tags);

		expect(runtimeMocks.captureException).toHaveBeenCalledExactlyOnceWith(
			originalError,
			{ tags },
		);
	});
});

describe("createDomainReconciliationRuntime", () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
	});

	it("wires both stale scans to their same-payload recovery functions", async () => {
		const updatedAt = new Date("2026-08-01T10:00:00.000Z");
		const configurationCandidate = {
			domainId: "11111111-1111-4111-8111-111111111111",
			nonce: "manual:persisted-nonce",
			updatedAt,
		};
		const purchaseCandidate = {
			domainId: "22222222-2222-4222-8222-222222222222",
			domainStatus: "registering" as const,
			orderId: "33333333-3333-4333-8333-333333333333",
			orderStatus: "paid" as const,
			updatedAt,
		};
		const findStaleConfigurationCandidates = vi
			.spyOn(DomainsRepository.prototype, "findStaleConfigurationCandidates")
			.mockResolvedValue([configurationCandidate]);
		const findStalePurchaseCandidates = vi
			.spyOn(DomainsRepository.prototype, "findStalePurchaseCandidates")
			.mockResolvedValue([purchaseCandidate]);
		const runtime = createDomainReconciliationRuntime(databaseStub());

		await expect(runtime.reconciler.execute()).resolves.toEqual({
			ensured: 2,
			processed: true,
			scanned: 2,
			skipped: 0,
		});
		expect(findStalePurchaseCandidates).toHaveBeenCalledOnce();
		expect(findStaleConfigurationCandidates).toHaveBeenCalledOnce();
		const purchaseInput = findStalePurchaseCandidates.mock.calls[0]?.[0];
		const configurationInput =
			findStaleConfigurationCandidates.mock.calls[0]?.[0];
		expect(purchaseInput?.limit).toBe(100);
		expect(configurationInput?.limit).toBe(100);
		expect(configurationInput?.staleBefore).toEqual(purchaseInput?.staleBefore);
		expect(runtimeMocks.recoverPurchase).toHaveBeenCalledWith({
			domainId: purchaseCandidate.domainId,
			orderId: purchaseCandidate.orderId,
		});
		expect(runtimeMocks.recoverConfiguration).toHaveBeenCalledWith({
			domainId: configurationCandidate.domainId,
			nonce: configurationCandidate.nonce,
		});
	});
});

describe("createDomainConfigurationRuntime", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		runtimeMocks.apexZoneSteps.length = 0;
	});

	it("wires an external-only apex zone pass whose registrar refuses to move nameservers", async () => {
		const runtime = createDomainConfigurationRuntime(databaseStub(), {
			apexZoneEnabled: true,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
			wait: { until: vi.fn(async () => undefined) },
		});
		const step = lastApexZoneStep();

		expect(runtime.configuration).toBeDefined();
		expect(runtimeMocks.apexZoneSteps).toHaveLength(1);
		expect(step.options).toEqual({
			enabled: true,
			fallbackOrigin: "customers.wandit.app",
			sources: ["external"],
		});
		expect(step.registrar).not.toBeInstanceOf(NamecomProvider);
		await expect(
			step.registrar.setNameservers("example.com", ["a.ns.cloudflare.com"]),
		).rejects.toThrow("External domains delegate nameservers manually");
	});

	it("passes the kill switch through to the external composition", () => {
		createDomainConfigurationRuntime(databaseStub(), {
			apexZoneEnabled: false,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
			wait: { until: vi.fn(async () => undefined) },
		});

		expect(lastApexZoneStep().options).toMatchObject({
			enabled: false,
			sources: ["external"],
		});
	});
});

describe("createDomainPurchaseRuntime", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		runtimeMocks.apexZoneSteps.length = 0;
	});

	it("keeps the purchased-only apex zone pass on the Name.com registrar", () => {
		createDomainPurchaseRuntime(databaseStub(), {
			apexZoneEnabled: true,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
			wait: { until: vi.fn(async () => undefined) },
		});
		const step = lastApexZoneStep();

		expect(runtimeMocks.apexZoneSteps).toHaveLength(1);
		expect(step.options).toEqual({
			enabled: true,
			fallbackOrigin: "customers.wandit.app",
			sources: ["purchased"],
		});
		expect(step.registrar).toBeInstanceOf(NamecomProvider);
	});
});

describe("createDomainApexBackfillRuntime", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		runtimeMocks.apexZoneSteps.length = 0;
	});

	it("composes the purchased-only step on the Name.com registrar", () => {
		createDomainApexBackfillRuntime(databaseStub(), {
			apexZoneEnabled: true,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
		});
		const step = lastApexZoneStep();

		expect(step.options.sources).toEqual(["purchased"]);
		expect(step.registrar).toBeInstanceOf(NamecomProvider);
	});

	it("merges apex dns keys fenced on the live statuses instead of replacing dns", async () => {
		const row = {
			cfCustomHostnameId: "cf_www",
			dns: {
				purchaseDnsConfigured: true,
				triggerConfiguration: {
					nextAttempt: 3,
					nextProbeAt: "2026-08-01T10:05:00.000Z",
					nonce: "purchase:22222222-2222-4222-8222-222222222222",
				},
			},
			error: null,
			expiresAt: null,
			id: "11111111-1111-4111-8111-111111111111",
			isPrimary: false,
			name: "example.com",
			paymentOrderId: null,
			projectId: null,
			provider: "namecom",
			providerDomainId: "example.com",
			providerOrderId: null,
			providerTotalPaidUsd: null,
			registrant: null,
			source: "purchased" as const,
			status: "configuring" as const,
			transferLockExpiresAt: null,
			updatedAt: new Date("2026-08-01T10:00:00.000Z"),
			whoisPrivacy: false,
		};
		const patch = { apexConfigured: true as const, apexError: null };
		const mergeDnsIfStatus = vi
			.spyOn(DomainsRepository.prototype, "mergeDnsIfStatus")
			.mockResolvedValueOnce({
				...row,
				dns: { ...row.dns, apexConfigured: true },
			} as never)
			.mockResolvedValueOnce(null);
		const updateIfStatusOrNull = vi.spyOn(
			DomainsRepository.prototype,
			"updateIfStatusOrNull",
		);
		const runtime = createDomainApexBackfillRuntime(databaseStub(), {
			apexZoneEnabled: true,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
		});

		await expect(
			runtime.state.persistApexDns(row, patch),
		).resolves.toMatchObject({
			dns: {
				apexConfigured: true,
				triggerConfiguration: { nextAttempt: 3 },
			},
		});
		expect(mergeDnsIfStatus).toHaveBeenCalledExactlyOnceWith(
			row.id,
			["registering", "configuring", "active"],
			patch,
		);
		// A full-replace write would copy the stale verification cursor back.
		expect(updateIfStatusOrNull).not.toHaveBeenCalled();
		await expect(runtime.state.persistApexDns(row, patch)).rejects.toThrow(
			`Domain ${row.id} left status configuring during apex configuration`,
		);
	});

	it("honors the kill switch: a disabled step returns the row without touching any provider", async () => {
		const mergeDnsIfStatus = vi.spyOn(
			DomainsRepository.prototype,
			"mergeDnsIfStatus",
		);
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const runtime = createDomainApexBackfillRuntime(databaseStub(), {
			apexZoneEnabled: false,
			fallbackOrigin: "customers.wandit.app",
			logger: { error: vi.fn(), warn: vi.fn() },
		});
		const row = {
			cfCustomHostnameId: "cf_www",
			dns: null,
			error: null,
			expiresAt: null,
			id: "11111111-1111-4111-8111-111111111111",
			isPrimary: false,
			name: "example.com",
			paymentOrderId: null,
			projectId: null,
			provider: "namecom",
			providerDomainId: "example.com",
			providerOrderId: null,
			providerTotalPaidUsd: null,
			registrant: null,
			source: "purchased" as const,
			status: "active" as const,
			transferLockExpiresAt: null,
			updatedAt: new Date("2026-08-01T10:00:00.000Z"),
			whoisPrivacy: false,
		};

		await expect(
			runtime.apexZone.execute(row, { allowZoneCreation: true }),
		).resolves.toBe(row);
		expect(mergeDnsIfStatus).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

function databaseStub(): Parameters<typeof createDomainFailureRuntime>[0] {
	return {} as Parameters<typeof createDomainFailureRuntime>[0];
}
