import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	OPENROUTER_API_KEY: undefined as string | undefined,
}));

const gatewayMocks = vi.hoisted(() => ({
	getGenerationInfo: vi.fn(),
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

vi.mock("@ai-sdk/gateway", () => ({
	gateway: { getGenerationInfo: gatewayMocks.getGenerationInfo },
}));

import { isGatewayUsagePending } from "../../metering/domain/metering";
import { createProviderMeteringGateway } from "./metering-provider-gateway";

beforeEach(() => {
	mockEnv.OPENROUTER_API_KEY = undefined;
	gatewayMocks.getGenerationInfo.mockReset();
});

describe("createProviderMeteringGateway", () => {
	it("routes vercel refs to the AI Gateway client", async () => {
		gatewayMocks.getGenerationInfo.mockResolvedValue({ id: "gen_1" });

		const result = await createProviderMeteringGateway().getGenerationInfo({
			id: "gen_1",
			source: "vercel",
		});

		expect(result).toEqual({ id: "gen_1" });
		expect(gatewayMocks.getGenerationInfo).toHaveBeenCalledWith({
			id: "gen_1",
		});
	});

	it("fails retryably when the OpenRouter key is missing", async () => {
		// The ref outlives the routing config that produced it; a reconciler
		// without the key must leave the event selectable for a later sweep,
		// not terminalize it.
		const rejection = await createProviderMeteringGateway()
			.getGenerationInfo({ id: "gen-or-1", source: "openrouter" })
			.then(
				() => null,
				(error: unknown) => error,
			);

		expect(rejection).toMatchObject({
			message: expect.stringContaining("OPENROUTER_API_KEY is required"),
			retryable: true,
		});
		expect(isGatewayUsagePending(rejection)).toBe(true);
		expect(gatewayMocks.getGenerationInfo).not.toHaveBeenCalled();
	});
});
