import { posix } from "node:path";

import { describe, expect, it } from "vitest";

import { ClaudeCodeHarness } from "../../application/harness/claude-code.harness";
import type {
	SandboxCreateOptions,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
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

			// The harness runs the agent in <vendor cwd>/<workDir>: the handle's
			// workspace must sit right under the vendor cwd, and the template
			// init must have committed the project inside it.
			const pwd = await handle.exec("pwd", []);
			expect(posix.dirname(handle.workspaceDir)).toBe(pwd.stdout.trim());
			const gitDir = await handle.exec("test", ["-d", ".git"], {
				cwd: handle.workspaceDir,
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

	// The snapshot stays in the vendor on purpose: it is the real template
	// snapshot of this template and harness, so a second run answers "exists".
	it("boots a new project from the template snapshot with the harness installed", async () => {
		const provider = new VercelSandboxProvider(
			new FakeSandboxSessionsRepository(),
			new LoggingRepoRestorer(),
			new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		);
		const harness = new ClaudeCodeHarness();
		const harnessKey = await harness.bootstrapKey();
		const template = {
			framework: OPTIONS.framework,
			templateVersion: OPTIONS.templateVersion,
		};
		const projectId = `it-snapshot-${Date.now()}`;

		const builtAt = Date.now();
		const outcome = await provider.ensureTemplateSnapshot(template, {
			key: harnessKey,
			prepare: (sandbox) => harness.prepareSandbox(sandbox),
		});
		console.log(`template snapshot ${outcome} in ${Date.now() - builtAt}ms`);
		expect(
			await provider.ensureTemplateSnapshot(template, {
				key: harnessKey,
				prepare: (sandbox) => harness.prepareSandbox(sandbox),
			}),
		).toBe("exists");

		try {
			const startedAt = Date.now();
			const handle = await provider.getOrCreate(projectId, {
				...OPTIONS,
				harnessKey,
			});
			console.log(`create from the snapshot took ${Date.now() - startedAt}ms`);

			const commit = await handle.exec("git", ["log", "--format=%s"], {
				cwd: handle.workspaceDir,
			});
			expect(commit.stdout.trim()).toBe(
				`init: template ${OPTIONS.templateVersion}`,
			);
			const packages = await handle.exec("test", ["-d", "node_modules"], {
				cwd: handle.workspaceDir,
			});
			expect(packages.exitCode).toBe(0);
			// The harness marker: the first session skips the Claude Code install.
			const marker = await handle.exec(
				"sh",
				["-c", "ls .harness-bootstrap/claude-code/.bootstrap-*.ok"],
				{ cwd: posix.dirname(handle.workspaceDir) },
			);
			expect(marker.exitCode).toBe(0);
		} finally {
			await provider.destroy(projectId);
		}
	}, 900_000);
});
