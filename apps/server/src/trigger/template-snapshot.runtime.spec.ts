import type { TargetPlatform } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import {
	FAKE_HARNESS_BOOTSTRAP_KEY,
	FakeBuilderHarness,
} from "../modules/app-builder/application/harness/fake.harness";
import type { SandboxHandle } from "../modules/app-builder/domain/ports/sandbox-provider";
import { FakeSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import {
	runTemplateSnapshotBuild,
	type TemplateSnapshotDeps,
} from "./template-snapshot.runtime";

type EnsureCall = {
	template: { framework: string; templateVersion: string };
	harnessKey: string;
};

/** Answers per framework: an outcome, or an error to throw. */
function setup(answers: Record<string, "exists" | "built" | Error>) {
	const calls: EnsureCall[] = [];
	const harness = new FakeBuilderHarness();
	const sandbox: Promise<SandboxHandle> = new FakeSandboxProvider().getOrCreate(
		"template-builder",
		{
			devCommand: "pnpm run dev",
			devPort: 5173,
			env: {},
			framework: "web-app",
			organizationId: null,
			ownerUserId: "system",
			templateVersion: "web-app@1.0.0",
		},
	);
	const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
	const deps: TemplateSnapshotDeps = {
		harness,
		logger,
		provider: {
			ensureTemplateSnapshot: async (template, harnessInput) => {
				calls.push({ harnessKey: harnessInput.key, template });
				const answer = answers[template.framework];
				if (answer === undefined || answer instanceof Error) {
					throw answer ?? new Error(`no answer for ${template.framework}`);
				}
				// Like the provider: a build installs the harness in the builder sandbox.
				if (answer === "built") {
					await harnessInput.prepare(await sandbox);
				}
				return answer;
			},
		},
		versions: {
			versionFor: (platform: TargetPlatform) =>
				platform === "web" ? "web-app@1.0.0" : "mobile-app@1.1.0",
		},
	};
	return { calls, deps, harness, logger };
}

describe("runTemplateSnapshotBuild", () => {
	it("ensures a snapshot per platform with the harness key and counts the outcomes", async () => {
		const { calls, deps, harness } = setup({
			"mobile-app": "exists",
			"web-app": "built",
		});

		const result = await runTemplateSnapshotBuild(deps);

		expect(result).toEqual({ built: 1, existing: 1, failed: 0 });
		expect(calls).toEqual([
			{
				harnessKey: FAKE_HARNESS_BOOTSTRAP_KEY,
				template: { framework: "web-app", templateVersion: "web-app@1.0.0" },
			},
			{
				harnessKey: FAKE_HARNESS_BOOTSTRAP_KEY,
				template: {
					framework: "mobile-app",
					templateVersion: "mobile-app@1.1.0",
				},
			},
		]);
		// Only the build installs the harness.
		expect(harness.preparedSandboxIds).toEqual(["fake-template-builder"]);
	});

	it("logs a failed platform, builds the next one, then fails the run", async () => {
		const { calls, deps, harness, logger } = setup({
			"mobile-app": "built",
			"web-app": new Error("install failed"),
		});

		await expect(runTemplateSnapshotBuild(deps)).rejects.toThrow(
			"failed for 1 platform(s)",
		);

		expect(calls.map((call) => call.template.framework)).toEqual([
			"web-app",
			"mobile-app",
		]);
		expect(harness.preparedSandboxIds).toHaveLength(1);
		expect(logger.error).toHaveBeenCalledWith(
			"sandbox.template-snapshot.failed",
			{ error: "install failed", framework: "web-app" },
		);
	});
});
