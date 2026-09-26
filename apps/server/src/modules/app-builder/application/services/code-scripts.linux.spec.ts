import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { SandboxReader } from "../../domain/ports/sandbox-provider";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import { CodeService } from "./code.service";

// The two bash scripts of CodeService read /proc/self/fd and use GNU
// coreutils flags, so this spec runs on Linux only. CI runs on ubuntu-latest.
const IS_LINUX = process.platform === "linux";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

/** Runs a command like the sandbox does, but on this machine. */
function localReader(worktree: string): SandboxReader {
	return {
		exec: async (command, args, options) => {
			const result = spawnSync(command, args, {
				cwd: options?.cwd,
				encoding: "utf8",
				timeout: options?.timeoutMs,
			});
			return {
				exitCode: result.status ?? 1,
				stderr: result.stderr,
				stdout: result.stdout,
			};
		},
		projectId: "p-1",
		workspaceDir: worktree,
	};
}

function git(worktree: string, args: string[]): void {
	const result = spawnSync("git", args, { cwd: worktree, encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

describe.skipIf(!IS_LINUX)("CodeService scripts on a real worktree", () => {
	let root = "";
	let service: CodeService;

	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "code-scripts-"));
		const worktree = join(root, "workspace");
		mkdirSync(join(worktree, "src", "dir"), { recursive: true });
		writeFileSync(join(worktree, "src", "app.tsx"), "export const app = 1;\n");
		// Above the 64 KB prefetch cap, below the 512 KB file cap.
		writeFileSync(join(worktree, "big.txt"), "x".repeat(70_000));
		writeFileSync(join(worktree, ".env"), "TOKEN=secret\n");
		writeFileSync(join(root, "outside.txt"), "outside\n");
		symlinkSync(join(root, "outside.txt"), join(worktree, "src", "out.txt"));
		symlinkSync("../.env", join(worktree, "src", "env.txt"));
		// The listing needs a repository with a HEAD.
		git(worktree, ["init", "-q", "-b", "main"]);
		git(worktree, [
			"-c",
			"user.email=spec@example.com",
			"-c",
			"user.name=spec",
			"commit",
			"-q",
			"--allow-empty",
			"-m",
			"init",
		]);
		service = new CodeService(
			{ findScopedProject: async () => PROJECT },
			{ findRunning: async () => localReader(worktree) },
		);
	});

	afterAll(() => {
		rmSync(root, { force: true, recursive: true });
	});

	it("reads a file inside the worktree", async () => {
		expect(await service.file(SCOPE, "p-1", "src/app.tsx")).toEqual({
			binary: false,
			content: "export const app = 1;\n",
			path: "src/app.tsx",
			size: 22,
		});
	});

	it.each([
		"src/out.txt",
		"src/env.txt",
	])("answers 400 for the symlink %s and reads no bytes", async (path) => {
		await expect(service.file(SCOPE, "p-1", path)).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it.each([
		"missing.ts",
		"src/dir",
	])("answers 404 for %s, which is not a regular file", async (path) => {
		await expect(service.file(SCOPE, "p-1", path)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("prefetches the small file and skips the large file and both symlinks", async () => {
		const snapshot = await service.snapshot(SCOPE, "p-1");

		expect(snapshot.branch).toBe("main");
		expect(snapshot.files.map((file) => file.path)).toEqual(["src/app.tsx"]);
	});
});
