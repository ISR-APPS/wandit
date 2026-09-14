import { ServiceUnavailableException } from "@nestjs/common";
import { v2HarnessSchema } from "@wandit/env/v2-harness";
import { describe, expect, it } from "vitest";

import { requireV2Env, V2_ENV_NAMES, v2EnvPresence } from "./v2-env";

describe("requireV2Env", () => {
	it("throws a 503 with V2_ENV_MISSING naming the variable when unset", () => {
		expect.assertions(3);
		try {
			requireV2Env("VERCEL_SANDBOX_TOKEN", { V2_HARNESS: "claude-code" });
		} catch (error) {
			expect(error).toBeInstanceOf(ServiceUnavailableException);
			// SAFETY: the instanceof check above proves the type.
			const thrown = error as ServiceUnavailableException;
			expect(thrown.getStatus()).toBe(503);
			expect(thrown.getResponse()).toMatchObject({
				code: "V2_ENV_MISSING",
				message: "VERCEL_SANDBOX_TOKEN is not set",
			});
		}
	});

	it("returns the value when set", () => {
		expect(
			requireV2Env("VERCEL_SANDBOX_TOKEN", {
				V2_HARNESS: "claude-code",
				VERCEL_SANDBOX_TOKEN: "vs_token",
			}),
		).toBe("vs_token");
	});
});

describe("v2EnvPresence", () => {
	it("reports one boolean per contract name and never a value", () => {
		const presence = v2EnvPresence({
			V2_HARNESS: "claude-code",
			VERCEL_SANDBOX_TOKEN: "vs_token",
		});

		expect(Object.keys(presence).sort()).toEqual([...V2_ENV_NAMES].sort());
		expect(presence.VERCEL_SANDBOX_TOKEN).toBe(true);
		expect(presence.ANTHROPIC_API_KEY).toBe(false);
		for (const value of Object.values(presence)) {
			expect(typeof value).toBe("boolean");
		}
	});
});

describe("v2HarnessSchema", () => {
	it("parses undefined as claude-code", () => {
		expect(v2HarnessSchema.parse(undefined)).toBe("claude-code");
	});

	it("accepts opencode", () => {
		expect(v2HarnessSchema.parse("opencode")).toBe("opencode");
	});

	it("rejects an unknown harness", () => {
		expect(v2HarnessSchema.safeParse("cursor").success).toBe(false);
	});
});
