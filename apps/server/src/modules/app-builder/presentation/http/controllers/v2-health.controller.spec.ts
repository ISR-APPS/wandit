import { NotFoundException } from "@nestjs/common";
import { v2HealthResponseSchema } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { V2EnvSource } from "../../../infrastructure/env/v2-env";
import { V2HealthController } from "./v2-health.controller";

afterEach(() => vi.unstubAllEnvs());

describe("V2HealthController", () => {
	it("keeps secret values out of local diagnostics", () => {
		vi.stubEnv("NODE_ENV", "development");
		const fakeEnv: V2EnvSource = {
			V2_HARNESS: "claude-code",
			V2_DEFAULT_MODEL: "openai/gpt-5.6-luna",
			VERCEL_SANDBOX_TOKEN: "vs_secret_token",
		};
		const controller = new V2HealthController(fakeEnv);

		const body = controller.health();
		const parsed = v2HealthResponseSchema.parse(body);

		expect(parsed.enabled).toBe(true);
		expect(parsed.harness).toBe("claude-code");
		expect(parsed.model).toBe("openai/gpt-5.6-luna");
		expect(parsed.env.VERCEL_SANDBOX_TOKEN).toBe(true);
		expect(parsed.env.ANTHROPIC_API_KEY).toBe(false);
		// No secret value ever leaves the process.
		expect(JSON.stringify(body)).not.toContain("vs_secret_token");
	});

	it.each([
		"production",
		"test",
	])("blocks model and provider diagnostics outside local development (%s)", (nodeEnv) => {
		vi.stubEnv("NODE_ENV", nodeEnv);
		const controller = new V2HealthController({
			V2_HARNESS: "opencode",
			V2_DEFAULT_MODEL: "private-provider/private-model",
		});

		expect(() => controller.health()).toThrow(NotFoundException);
	});
});
