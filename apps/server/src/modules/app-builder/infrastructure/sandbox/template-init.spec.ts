import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TemplateArchiveMissingError } from "../../domain/errors/template-archive-missing.error";
import type {
	SandboxCreateOptions,
	SandboxLogger,
} from "../../domain/ports/sandbox-provider";
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

describe("hashTemplateArchive", () => {
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

describe("ArchiveTemplateInit.replaceOldTemplateFiles", () => {
	// templates/web-app/vite.config.ts at commit 2426225b. CI clones with
	// depth 1, so the spec cannot read it from git history.
	const OLD_VITE_CONFIG = [
		"// Vite build configuration for the generated web app.",
		"// The dev server and the Cloudflare worker build read this file.",
		"// WANDIT_PREVIEW_HOST opens the sandbox dev server to the preview iframe.",
		'import { cloudflare } from "@cloudflare/vite-plugin";',
		'import tailwindcss from "@tailwindcss/vite";',
		'import { tanstackStart } from "@tanstack/react-start/plugin/vite";',
		'import viteReact from "@vitejs/plugin-react";',
		'import { defineConfig } from "vite";',
		"",
		"// The sandbox sets this variable to the public preview hostname.",
		"const previewHost = process.env.WANDIT_PREVIEW_HOST;",
		"",
		"export default defineConfig({",
		"\tresolve: {",
		"\t\t// Vite reads the ~/* alias from tsconfig.json paths.",
		"\t\ttsconfigPaths: true,",
		"\t},",
		"\tserver: {",
		"\t\t// The preview tunnel needs an explicit host allowlist.",
		"\t\tallowedHosts: previewHost ? [previewHost] : [],",
		"\t\t// clientPort and wss point the HMR client at the HTTPS tunnel on 443.",
		"\t\t// `port` would bind a second WebSocket server that the sandbox rejects.",
		"\t\tws: previewHost",
		'\t\t\t? { host: previewHost, clientPort: 443, protocol: "wss" }',
		"\t\t\t: undefined,",
		"\t},",
		"\tplugins: [",
		'\t\tcloudflare({ viteEnvironment: { name: "ssr" } }),',
		"\t\ttanstackStart({",
		"\t\t\t// Public pages are prerendered at build time. Auth pages stay dynamic.",
		"\t\t\tprerender: { enabled: true },",
		"\t\t}),",
		"\t\tviteReact(),",
		"\t\ttailwindcss(),",
		"\t],",
		"});",
		"",
	].join("\n");
	const CURRENT_VITE_CONFIG = "export default {}; // the archive copy\n";
	const VITE_CONFIG = `${FAKE_WORKSPACE_DIR}/vite.config.ts`;

	/** A web-app archive with the current file, and a sandbox with `restored`. */
	async function setup(restored: string | null, logger?: SandboxLogger) {
		const dir = await mkdtemp(join(tmpdir(), "wandit-tpl-vite-"));
		await writeFile(
			join(dir, "web-app-1.0.0.tar.gz"),
			await pack({ "vite.config.ts": CURRENT_VITE_CONFIG }, "202601010000"),
		);
		const provider = new FakeSandboxProvider();
		const handle = await provider.getOrCreate("p1", CREATE_OPTIONS);
		if (restored !== null) {
			await handle.writeFiles([{ content: restored, path: VITE_CONFIG }]);
		}
		const callsBefore = provider.calls.length;
		return {
			handle,
			init: new ArchiveTemplateInit(dir, logger),
			/** Vendor calls after the setup, by method name. */
			vendorCalls: () =>
				provider.calls.slice(callsBefore).map((call) => call.method),
			/** The sandbox file as text, or null when it is absent. */
			viteConfig: async () => {
				const bytes = await handle.readFile(VITE_CONFIG);
				return bytes === null ? null : new TextDecoder().decode(bytes);
			},
		};
	}

	it.each([
		{
			name: "replaces an old web-app file",
			framework: "web-app",
			restored: OLD_VITE_CONFIG,
			expected: CURRENT_VITE_CONFIG,
			// The second read is `.claude/settings.json`, which this sandbox lacks.
			calls: ["readFile", "writeFiles", "readFile"],
		},
		{
			name: "keeps an old file that the agent changed",
			framework: "web-app",
			restored: `${OLD_VITE_CONFIG}// edited\n`,
			expected: `${OLD_VITE_CONFIG}// edited\n`,
			calls: ["readFile", "readFile"],
		},
		{
			name: "keeps a missing file missing",
			framework: "web-app",
			restored: null,
			expected: null,
			calls: ["readFile", "readFile"],
		},
		{
			name: "reads no Vite config in a mobile-app project",
			framework: "mobile-app",
			restored: OLD_VITE_CONFIG,
			expected: OLD_VITE_CONFIG,
			// Only `.claude/settings.json` is a mobile-app template file.
			calls: ["readFile"],
		},
	])("$name", async ({ framework, restored, expected, calls }) => {
		const { init, handle, vendorCalls, viteConfig } = await setup(restored);

		await init.replaceOldTemplateFiles(handle, {
			framework,
			templateVersion: `${framework}@1.0.0`,
		});

		expect(vendorCalls()).toEqual(calls);
		expect(await viteConfig()).toBe(expected);
	});

	it("logs with the projectId and resolves when the archive is missing", async () => {
		const warnings: Record<string, string>[] = [];
		const logger: SandboxLogger = {
			error: () => undefined,
			info: () => undefined,
			warn: (_message, fields) => {
				warnings.push(fields);
			},
		};
		const { init, handle, viteConfig } = await setup(OLD_VITE_CONFIG, logger);

		// The sandbox start must go on with the old file.
		await init.replaceOldTemplateFiles(handle, {
			framework: "web-app",
			templateVersion: "web-app@9.9.9",
		});

		expect(warnings).toEqual([expect.objectContaining({ projectId: "p1" })]);
		expect(await viteConfig()).toBe(OLD_VITE_CONFIG);
	});

	it("replaces the settings.json that lacks the git restore, stash, and clean denies", async () => {
		const current = await readFile(
			resolve(
				dirname(fileURLToPath(import.meta.url)),
				"../../../../../../../templates/mobile-app/.claude/settings.json",
			),
			"utf8",
		);
		// The file of commit cca4e62c is the current file without these three lines.
		const old = current.replace(
			'\t\t\t"Bash(git restore*)",\n\t\t\t"Bash(git stash*)",\n\t\t\t"Bash(git clean*)",\n',
			"",
		);
		// An unchanged string makes the case pass with no replacement.
		expect(old).not.toBe(current);
		const dir = await mkdtemp(join(tmpdir(), "wandit-tpl-settings-"));
		await writeFile(
			join(dir, "mobile-app-1.0.0.tar.gz"),
			await pack({ ".claude/settings.json": current }, "202601010000"),
		);
		const provider = new FakeSandboxProvider();
		const handle = await provider.getOrCreate("p1", {
			...CREATE_OPTIONS,
			framework: "mobile-app",
		});
		const settingsPath = `${FAKE_WORKSPACE_DIR}/.claude/settings.json`;
		await handle.writeFiles([{ content: old, path: settingsPath }]);

		await new ArchiveTemplateInit(dir).replaceOldTemplateFiles(handle, {
			framework: "mobile-app",
			templateVersion: "mobile-app@1.0.0",
		});

		const restored = await handle.readFile(settingsPath);
		expect(restored === null ? null : new TextDecoder().decode(restored)).toBe(
			current,
		);
	});
});
