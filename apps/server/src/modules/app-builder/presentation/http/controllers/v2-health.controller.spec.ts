import { v2EnvNames, v2HealthResponseSchema } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { V2EnvSource } from "../../../infrastructure/env/v2-env";
import { V2HealthController } from "./v2-health.controller";

describe("V2HealthController", () => {
	it("answers the health contract with enabled true and per-name booleans", () => {
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
		expect(Object.keys(parsed.env).sort()).toEqual([...v2EnvNames].sort());
		expect(parsed.env.VERCEL_SANDBOX_TOKEN).toBe(true);
		expect(parsed.env.ANTHROPIC_API_KEY).toBe(false);
		// No secret value ever leaves the process.
		expect(JSON.stringify(body)).not.toContain("vs_secret_token");
	});

	it("reports a null model when no default model is set", () => {
		const controller = new V2HealthController({ V2_HARNESS: "opencode" });

		expect(controller.health().model).toBeNull();
	});
});
