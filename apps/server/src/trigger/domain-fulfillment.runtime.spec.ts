import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
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
import { DomainsRepository } from "../modules/domains/infrastructure/persistence/domains.repository";
import {
	createDomainFailureRuntime,
	createDomainReconciliationRuntime,
} from "./domain-fulfillment.runtime";

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

function databaseStub(): Parameters<typeof createDomainFailureRuntime>[0] {
	return {} as Parameters<typeof createDomainFailureRuntime>[0];
}
