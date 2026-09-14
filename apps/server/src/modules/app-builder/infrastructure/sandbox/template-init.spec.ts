import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TemplateArchiveMissingError } from "../../domain/errors/template-archive-missing.error";
import type { SandboxCreateOptions } from "../../domain/ports/sandbox-provider";
import { SANDBOX_WORKSPACE_DIR } from "../../domain/ports/sandbox-provider";
import { FakeSandboxProvider } from "./fake-sandbox.provider";
import { ArchiveTemplateInit } from "./template-init";

const CREATE_OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm dev",
	devPort: 3000,
	env: {},
	framework: "web-app",
	organizationId: null,
	ownerUserId: "user-1",
	templateVersion: "web-app@1.0.0",
};

const OK = { exitCode: 0, stderr: "", stdout: "" };
const FAIL = { exitCode: 1, stderr: "failed", stdout: "" };

async function templateDirWithArchive() {
	const dir = await mkdtemp(join(tmpdir(), "wandit-tpl-"));
	await writeFile(join(dir, "web-app-1.0.0.tar.gz"), "fake-archive");
	return dir;
}

function execLines(provider: FakeSandboxProvider): string[] {
	return provider.calls
		.filter((call) => call.method === "exec")
		.map((call) => call.detail ?? "");
}

describe("ArchiveTemplateInit", () => {
	it("uploads, extracts, installs offline, and commits a fresh repo", async () => {
		const provider = new FakeSandboxProvider();
		for (const command of ["mkdir", "tar", "pnpm"]) {
			provider.respondTo(command, OK);
		}
		for (const result of [FAIL, OK, OK, OK]) {
			provider.respondTo("git", result);
		}
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);
		const init = new ArchiveTemplateInit(await templateDirWithArchive());

		await init.apply(handle, {
			framework: "web-app",
			templateVersion: "web-app@1.0.0",
		});

		expect(execLines(provider)).toEqual([
			`mkdir -p ${SANDBOX_WORKSPACE_DIR}`,
			`tar -xzf /tmp/template.tar.gz -C ${SANDBOX_WORKSPACE_DIR}`,
			"pnpm install --frozen-lockfile --offline",
			"git rev-parse --git-dir",
			"git init",
			"git add -A",
			"git -c user.name=wandit -c user.email=builder@wandit.dev commit -m init: template web-app@1.0.0",
		]);
	});

	it("falls back to an online install when the offline install fails", async () => {
		const provider = new FakeSandboxProvider();
		provider.respondTo("mkdir", OK);
		provider.respondTo("tar", OK);
		provider.respondTo("pnpm", FAIL);
		provider.respondTo("pnpm", OK);
		provider.respondTo("git", OK);
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);
		const init = new ArchiveTemplateInit(await templateDirWithArchive());

		await init.apply(handle, {
			framework: "web-app",
			templateVersion: "web-app@1.0.0",
		});

		expect(execLines(provider)).toContain("pnpm install --frozen-lockfile");
		expect(
			execLines(provider).filter((line) => line.startsWith("git ")),
		).toEqual(["git rev-parse --git-dir"]);
	});

	it("throws TemplateArchiveMissingError naming the path when the archive is absent", async () => {
		const provider = new FakeSandboxProvider();
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);
		const emptyDir = await mkdtemp(join(tmpdir(), "wandit-tpl-empty-"));
		const init = new ArchiveTemplateInit(emptyDir);

		const promise = init.apply(handle, {
			framework: "web-app",
			templateVersion: "web-app@1.0.0",
		});
		await expect(promise).rejects.toBeInstanceOf(TemplateArchiveMissingError);
		await expect(promise).rejects.toThrow(
			join(emptyDir, "web-app-1.0.0.tar.gz"),
		);
	});
});
