import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { TemplateArchiveMissingError } from "../../domain/errors/template-archive-missing.error";
import type { SandboxCreateOptions } from "../../domain/ports/sandbox-provider";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "./fake-sandbox.provider";
import {
	ArchiveTemplateInit,
	hashTemplateArchive,
	resolveTemplateArchiveDir,
} from "./template-init";

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

describe("resolveTemplateArchiveDir", () => {
	it("returns the explicit env folder unchanged", () => {
		expect(
			resolveTemplateArchiveDir("/opt/wandit/templates", "/elsewhere"),
		).toBe("/opt/wandit/templates");
	});

	it("picks <cwd>/templates when it exists", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "wandit-cwd-"));
		await mkdir(join(cwd, "templates"));

		expect(resolveTemplateArchiveDir(undefined, cwd)).toBe(
			join(cwd, "templates"),
		);
	});

	it("picks <cwd>/../../templates for a process started in apps/server", async () => {
		const root = await mkdtemp(join(tmpdir(), "wandit-root-"));
		await mkdir(join(root, "templates"));
		await mkdir(join(root, "apps", "server"), { recursive: true });

		expect(
			resolveTemplateArchiveDir(undefined, join(root, "apps", "server")),
		).toBe(join(root, "templates"));
	});

	it("falls back to the repo folder next to the source when nothing exists", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "wandit-empty-"));

		// The fallback names a real path so a missing archive error can show it.
		expect(
			resolveTemplateArchiveDir(undefined, cwd).endsWith("/templates"),
		).toBe(true);
	});
});

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
			`mkdir -p ${FAKE_WORKSPACE_DIR}`,
			`tar -xzf /tmp/template.tar.gz -C ${FAKE_WORKSPACE_DIR}`,
			"pnpm install --frozen-lockfile --offline",
			"git rev-parse --git-dir",
			"git init",
			"git add -A",
			"git -c user.name=wandit -c user.email=builder@wandit.dev commit -m init: template web-app@1.0.0",
		]);
		// A fixed date: the same files give the same root commit in every sandbox.
		expect(provider.execOptions.at(-1)?.env).toEqual({
			GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
			GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
		});
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

describe("hashTemplateArchive", () => {
	// Packs `files` with the system tar, like templates/*/scripts/pack.mjs,
	// with every file time set to `time` (touch -t format). `links` maps a
	// symlink path to its target.
	async function pack(
		files: Record<string, string>,
		time: string,
		links: Record<string, string> = {},
	) {
		const root = await mkdtemp(join(tmpdir(), "wandit-pack-"));
		const source = join(root, "source");
		for (const [path, content] of Object.entries(files)) {
			await mkdir(dirname(join(source, path)), { recursive: true });
			await writeFile(join(source, path), content);
			execFileSync("touch", ["-t", time, join(source, path)]);
		}
		for (const [path, target] of Object.entries(links)) {
			await symlink(target, join(source, path));
		}
		const archive = join(root, "template.tar.gz");
		execFileSync("tar", ["-czf", archive, "-C", source, "."], {
			env: { ...process.env, COPYFILE_DISABLE: "1" },
		});
		return readFile(archive);
	}

	const FILES = { "package.json": "{}", "src/app.tsx": "export {};" };

	it("gives the same hash for the same files packed at another time", async () => {
		const first = await pack(FILES, "202601010000");
		const second = await pack(FILES, "202609260000");

		// The bytes differ (file times), so the hash must read the content.
		expect(first.equals(second)).toBe(false);
		expect(hashTemplateArchive(second)).toBe(hashTemplateArchive(first));
	});

	it("gives a new hash when one file changes", async () => {
		const first = await pack(FILES, "202601010000");
		const changed = await pack(
			{ ...FILES, "src/app.tsx": "export const x = 1;" },
			"202601010000",
		);

		expect(hashTemplateArchive(changed)).not.toBe(hashTemplateArchive(first));
	});

	it("gives a new hash when a symlink gets a new target", async () => {
		const first = await pack(FILES, "202601010000", {
			"tsconfig.json": "package.json",
		});
		const moved = await pack(FILES, "202601010000", {
			"tsconfig.json": "src/app.tsx",
		});

		expect(hashTemplateArchive(moved)).not.toBe(hashTemplateArchive(first));
	});

	it("contentHash hashes the archive of the template version", async () => {
		const dir = await mkdtemp(join(tmpdir(), "wandit-tpl-hash-"));
		const bytes = await pack(FILES, "202601010000");
		await writeFile(join(dir, "web-app-1.0.0.tar.gz"), bytes);

		const hash = await new ArchiveTemplateInit(dir).contentHash({
			framework: "web-app",
			templateVersion: "web-app@1.0.0",
		});

		expect(hash).toBe(hashTemplateArchive(bytes));
	});
});
