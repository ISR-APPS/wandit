import { describe, expect, it } from "vitest";

import { SandboxEnvRejectedError } from "../../domain/errors/sandbox-env-rejected.error";
import { buildSandboxEnv, SANDBOX_ENV_ALLOW_LIST } from "./sandbox-env";

const INPUT = {
	previewHost: null,
	proxyBaseUrl: "https://llm-proxy.test",
	proxyToken: "run-token-1",
	runId: "run-1",
	supabaseAnonKey: "anon-key-1",
	supabaseUrl: "https://project.supabase.co",
};

describe("buildSandboxEnv", () => {
	it("returns the allow-listed env map with an empty Anthropic key", () => {
		const env = buildSandboxEnv(INPUT);

		expect(env).toEqual({
			ANTHROPIC_AUTH_TOKEN: "run-token-1",
			ANTHROPIC_BASE_URL: "https://llm-proxy.test",
			ANTHROPIC_API_KEY: "",
			ANTHROPIC_CUSTOM_HEADERS: "X-Wandit-Run: run-1",
			CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
			EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-key-1",
			EXPO_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			VITE_SUPABASE_ANON_KEY: "anon-key-1",
			VITE_SUPABASE_URL: "https://project.supabase.co",
		});
	});

	it("omits both Supabase pairs when the backend row is missing", () => {
		const env = buildSandboxEnv({
			...INPUT,
			supabaseAnonKey: null,
			supabaseUrl: null,
		});

		expect(env).not.toHaveProperty("VITE_SUPABASE_URL");
		expect(env).not.toHaveProperty("VITE_SUPABASE_ANON_KEY");
		expect(env).not.toHaveProperty("EXPO_PUBLIC_SUPABASE_URL");
		expect(env).not.toHaveProperty("EXPO_PUBLIC_SUPABASE_ANON_KEY");
	});

	it("accepts the Expo names through extra and still rejects an unknown one", () => {
		const env = buildSandboxEnv({
			...INPUT,
			extra: { EXPO_PUBLIC_SUPABASE_URL: "https://other.supabase.co" },
		});

		expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe("https://other.supabase.co");
		expect(() =>
			buildSandboxEnv({
				...INPUT,
				extra: { EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "secret" },
			}),
		).toThrow(SandboxEnvRejectedError);
	});

	it("adds WANDIT_PREVIEW_HOST only when the caller passes a host", () => {
		const withHost = buildSandboxEnv({
			...INPUT,
			previewHost: "p.preview.test",
		});

		expect(withHost.WANDIT_PREVIEW_HOST).toBe("p.preview.test");
		expect(buildSandboxEnv(INPUT).WANDIT_PREVIEW_HOST).toBeUndefined();
	});

	it("rejects a platform secret passed through extra", () => {
		expect(() =>
			buildSandboxEnv({
				...INPUT,
				extra: { VERCEL_SANDBOX_TOKEN: "secret" },
			}),
		).toThrow(SandboxEnvRejectedError);
	});

	it("keeps ANTHROPIC_API_KEY empty when extra sets it", () => {
		const env = buildSandboxEnv({
			...INPUT,
			extra: { ANTHROPIC_API_KEY: "sk-real" },
		});

		expect(env.ANTHROPIC_API_KEY).toBe("");
	});

	it("keeps the telemetry flag on when extra sets it", () => {
		const env = buildSandboxEnv({
			...INPUT,
			extra: { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "0" },
		});

		expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
	});

	it("contains no name outside the allow list", () => {
		const allowed = new Set<string>(SANDBOX_ENV_ALLOW_LIST);
		const env = buildSandboxEnv({ ...INPUT, previewHost: "p.preview.test" });

		for (const name of Object.keys(env)) {
			expect(allowed.has(name)).toBe(true);
		}
	});
});
