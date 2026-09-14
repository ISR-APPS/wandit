import { posix } from "node:path";

import { describe, expect, it } from "vitest";

import type {
	SandboxCreateOptions,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import { SANDBOX_WORKSPACE_DIR } from "../../domain/ports/sandbox-provider";
import { LoggingRepoRestorer } from "../git/logging-repo-restorer";
import { FakeSandboxSessionsRepository } from "../persistence/fake-sandbox-sessions.repository";
import { ArchiveTemplateInit, TEMPLATE_ARCHIVE_DIR } from "./template-init";
import { VercelSandboxProvider } from "./vercel-sandbox.provider";

// Runs only with V2_SANDBOX_INTEGRATION_TEST=true: it creates a real
// sandbox on Vercel and costs money. CI never sets the flag.
const RUN = process.env.V2_SANDBOX_INTEGRATION_TEST === "true";

const OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm dev",
	devPort: 3000,
	env: {
		ANTHROPIC_AUTH_TOKEN: "integration-run-token",
		ANTHROPIC_BASE_URL: "https://llm-proxy.test",
		ANTHROPIC_API_KEY: "",
		VITE_SUPABASE_ANON_KEY: "integration-anon",
		VITE_SUPABASE_URL: "https://project.supabase.co",
	},
	framework: "web-app",
	organizationId: null,
	ownerUserId: "integration-user",
	templateVersion: "web-app@1.0.0",
};

async function sandboxEnvNames(handle: SandboxHandle): Promise<string[]> {
	const result = await handle.exec("printenv", []);
	return result.stdout
		.split("\n")
		.map((line) => line.split("=")[0] ?? "")
		.filter((name) => name.length > 0)
		.sort();
}

describe.skipIf(!RUN)("vercel sandbox integration", () => {
	it("creates, resumes, and destroys a real sandbox", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new VercelSandboxProvider(
			sessions,
			new LoggingRepoRestorer(),
			new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		);
		const projectId = `it-${Date.now()}`;

		try {
			const startedAt = Date.now();
			const handle = await provider.getOrCreate(projectId, OPTIONS);
			console.log(`create took ${Date.now() - startedAt}ms`);

			// The harness runs the agent in <vendor cwd>/<workDir>: `pwd`
			// must answer the parent of the workspace, and the template init
			// must have committed the project inside it.
			const pwd = await handle.exec("pwd", []);
			expect(pwd.stdout.trim()).toBe(posix.dirname(SANDBOX_WORKSPACE_DIR));
			const gitDir = await handle.exec("test", ["-d", ".git"], {
				cwd: SANDBOX_WORKSPACE_DIR,
			});
			expect(gitDir.exitCode).toBe(0);

			const namesAfterCreate = await sandboxEnvNames(handle);
			console.log("sandbox env names:", namesAfterCreate.join(","));
			expect(namesAfterCreate).toContain("VITE_SUPABASE_URL");
			expect(namesAfterCreate).toContain("VITE_SUPABASE_ANON_KEY");

			await provider.stop(projectId);

			const resumedAt = Date.now();
			const resumed = await provider.resume(projectId, OPTIONS);
			console.log(`resume took ${Date.now() - resumedAt}ms`);

			const namesAfterResume = await sandboxEnvNames(resumed);
			expect(namesAfterResume).toContain("VITE_SUPABASE_URL");
			expect(namesAfterResume).toContain("VITE_SUPABASE_ANON_KEY");
		} finally {
			await provider.destroy(projectId);
		}
	}, 600_000);
});
