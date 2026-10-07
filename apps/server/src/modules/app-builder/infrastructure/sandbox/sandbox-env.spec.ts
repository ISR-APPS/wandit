import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

import { describe, expect, it } from "vitest";

import { SandboxEnvRejectedError } from "../../domain/errors/sandbox-env-rejected.error";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "./fake-sandbox.provider";
import {
	buildSandboxEnv,
	SANDBOX_ENV_ALLOW_LIST,
	syncBackendEnvFile,
	WAIT_FOR_DEV_PORT_SCRIPT,
} from "./sandbox-env";

const INPUT = {
	previewHost: null,
	proxyBaseUrl: "https://llm-proxy.test",
	proxyToken: "run-token-1",
	runId: "run-1",
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
		});
	});

	it("adds WANDIT_PREVIEW_HOST only when the caller passes a host", () => {
		const withHost = buildSandboxEnv({
			...INPUT,
			previewHost: "p.preview.test",
		});

		expect(withHost.WANDIT_PREVIEW_HOST).toBe("p.preview.test");
		expect(buildSandboxEnv(INPUT).WANDIT_PREVIEW_HOST).toBeUndefined();
	});

	// A Supabase name in the process env would win over the `.env` value in Vite.
	it.each([
		"VERCEL_SANDBOX_TOKEN",
		"EXPO_PUBLIC_SUPABASE_URL",
	])("rejects %s passed through extra", (name) => {
		expect(() =>
			buildSandboxEnv({ ...INPUT, extra: { [name]: "value" } }),
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

describe("syncBackendEnvFile", () => {
	it("writes the four lines when they differ and leaves an equal file alone", async () => {
		const sandboxes = new FakeSandboxProvider();
		const sandbox = await sandboxes.getOrCreate("p1", {
			devCommand: "pnpm run dev",
			devPort: 8081,
			env: {},
			framework: "mobile-app",
			organizationId: null,
			ownerUserId: "user-1",
			templateVersion: "mobile-app@1.1.0",
		});
		const envPath = `${FAKE_WORKSPACE_DIR}/.env`;
		await sandbox.writeFiles([
			{ content: "VITE_SUPABASE_URL=https://old.supabase.co\n", path: envPath },
		]);
		// The dev port wait of the write; a fake port answers at once.
		sandboxes.respondTo("bash", { exitCode: 0, stderr: "", stdout: "" });
		const backend = {
			anonKey: "anon-key-1",
			url: "https://abcdefghijklmnopqrst.supabase.co",
		};

		await syncBackendEnvFile(sandbox, backend);
		// Each write restarts Vite, so a second turn with the same row must not write.
		await syncBackendEnvFile(sandbox, backend);

		// One write by the setup above, one by the first sync, none by the second.
		expect(
			sandboxes.calls.filter((call) => call.method === "writeFiles"),
		).toHaveLength(2);
		const bytes = await sandbox.readFile(envPath);
		expect(bytes === null ? null : new TextDecoder().decode(bytes)).toBe(
			[
				"VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co",
				"VITE_SUPABASE_ANON_KEY=anon-key-1",
				"EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co",
				"EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-key-1",
				"",
			].join("\n"),
		);
	});
});

describe("WAIT_FOR_DEV_PORT_SCRIPT", () => {
	it("exits 0 for an open port and 1 after its tries on a closed one", async () => {
		const server = createServer();
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const address = server.address();
		const openPort = typeof address === "object" && address ? address.port : 0;
		// Port 1 is privileged and never listens in a test.
		const runScript = (tries: string, ports: string[]) =>
			spawnSync(
				"bash",
				["-c", WAIT_FOR_DEV_PORT_SCRIPT, "wait-for-dev-port", tries, ...ports],
				{ timeout: 10_000 },
			).status;

		try {
			expect(runScript("2", ["1", String(openPort)])).toBe(0);
			expect(runScript("1", ["1"])).toBe(1);
		} finally {
			server.close();
		}
	});
});
