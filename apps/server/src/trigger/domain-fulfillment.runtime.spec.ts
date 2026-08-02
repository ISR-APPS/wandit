import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
	captureException: vi.fn(),
	terminalDependencies: null as unknown,
}));

vi.mock("@wandit/observability/node", () => ({
	Sentry: { captureException: runtimeMocks.captureException },
}));

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
import { createDomainFailureRuntime } from "./domain-fulfillment.runtime";

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

function databaseStub(): Parameters<typeof createDomainFailureRuntime>[0] {
	return {} as Parameters<typeof createDomainFailureRuntime>[0];
}
