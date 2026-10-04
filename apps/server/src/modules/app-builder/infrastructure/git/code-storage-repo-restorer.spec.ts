import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { GitStore } from "../../domain/ports/git-store";
import { hostExec } from "../eas/host-exec";
import { FakeSandboxProvider } from "../sandbox/fake-sandbox.provider";
import {
	CodeStorageRepoRestorer,
	RepoRestoreError,
} from "./code-storage-repo-restorer";

const JWT = "header.payload.signature";
const REMOTE = "https://org.code.storage/wandit/p-1.git";
// WANDIT-282: a git call with the JWT runs with hooks, credential helpers,
// and fsmonitor off. Literal, so a weaker flag list fails the spec.
const SAFE =
	"git -c core.hooksPath=/dev/null -c credential.helper= -c core.fsmonitor=false";

// Sandbox create options the provider contract requires; the restorer
// reads none of them.
const CREATE_OPTIONS = {
	devCommand: "pnpm dev",
	devPort: 5173,
	env: {},
	framework: "web-app",
	templateVersion: "web-app@1.0.0",
	ownerUserId: "user-1",
	organizationId: null,
};

// A head row for every project unless a test passes `null`.
function fakeCommits(head: { headSha: string } | null = { headSha: "abc123" }) {
	return { findBranch: vi.fn(async () => head) };
}

function fakeGitStore(remoteUrl = REMOTE): GitStore {
	return {
		deleteRepository: vi.fn(async () => undefined),
		ensureRepository: vi.fn(async () => ({ remoteUrl })),
		issueCredential: vi.fn(async () => ({
			expiresAt: new Date(Date.now() + 600_000),
			password: JWT,
			remoteUrl,
			username: "t",
		})),
	};
}

const OK = { exitCode: 0, stderr: "", stdout: "" };

let tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs = [];
});

function git(cwd: string, args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** A new temp folder with one commit of `files` (path to text) on `main`. */
function commitFiles(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "restorer-spec-"));
	tempDirs.push(dir);
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, path)), { recursive: true });
		writeFileSync(join(dir, path), text);
	}
	git(dir, ["init", "--quiet", "-b", "main"]);
	git(dir, ["add", "-A"]);
	git(dir, [
		"-c",
		"user.name=spec",
		"-c",
		"user.email=spec@example.com",
		"commit",
		"--quiet",
		"-m",
		"init: template web-app@1.0.0",
	]);
	return dir;
}

describe("CodeStorageRepoRestorer", () => {
	it("makes no git call when the project has no branch head yet", async () => {
		const provider = new FakeSandboxProvider();
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		const restorer = new CodeStorageRepoRestorer(
			fakeGitStore(),
			fakeCommits(null),
		);

		await restorer.restore("p-1", sandbox);

		// The template is the whole worktree until the first commitTurn pushes.
		expect(provider.calls.filter((call) => call.method === "exec")).toEqual([]);
	});

	it("fetches main with a read-only JWT when the sandbox already has .git", async () => {
		const provider = new FakeSandboxProvider();
		const gitStore = fakeGitStore();
		const restorer = new CodeStorageRepoRestorer(gitStore, fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		provider.respondTo("test", OK);
		for (const _step of ["fetch", "reset"]) {
			provider.respondTo("git", OK);
		}

		await restorer.restore("p-1", sandbox);

		const execs = provider.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail);
		expect(execs).toEqual([
			"test -d .git",
			`${SAFE} fetch https://t:${JWT}@org.code.storage/wandit/p-1.git main`,
			`${SAFE} reset --hard FETCH_HEAD`,
		]);
		// Sandbox code can read the JWT from the git argv: it must not push.
		expect(gitStore.issueCredential).toHaveBeenCalledWith(
			"p-1",
			expect.any(Number),
			"read",
		);
	});

	it("resets to the remote head when the template root differs from the project root", async () => {
		// The project repo starts from the template of its creation day.
		const project = commitFiles({
			".gitignore": "node_modules\n",
			"src/app.tsx": "turn 1\n",
			"vite.config.ts": "old template\n",
		});
		const remote = mkdtempSync(join(tmpdir(), "restorer-spec-remote-"));
		tempDirs.push(remote);
		git(remote, ["clone", "--quiet", "--bare", project, "."]);
		// A new sandbox holds the commit of the current template: another root.
		const workspace = commitFiles({
			".gitignore": "node_modules\n",
			"template-only.txt": "x\n",
			"vite.config.ts": "new template\n",
		});
		mkdirSync(join(workspace, "node_modules"));
		writeFileSync(join(workspace, "node_modules", "keep"), "");
		const restorer = new CodeStorageRepoRestorer(
			fakeGitStore(pathToFileURL(remote).href),
			fakeCommits(),
		);

		await restorer.restore("p-1", {
			exec: hostExec,
			workspaceDir: workspace,
		});

		expect(git(workspace, ["rev-parse", "HEAD"])).toBe(
			git(project, ["rev-parse", "HEAD"]),
		);
		expect(readFileSync(join(workspace, "vite.config.ts"), "utf8")).toBe(
			"old template\n",
		);
		expect(existsSync(join(workspace, "template-only.txt"))).toBe(false);
		// The package install is ignored, so the restore keeps it.
		expect(existsSync(join(workspace, "node_modules", "keep"))).toBe(true);
		expect(git(workspace, ["status", "--porcelain"])).toBe("");
	});

	it("rebuilds the worktree in place when the sandbox has no .git", async () => {
		const provider = new FakeSandboxProvider();
		const restorer = new CodeStorageRepoRestorer(fakeGitStore(), fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		provider.respondTo("test", { exitCode: 1, stderr: "", stdout: "" });
		for (const _step of ["init", "fetch", "reset", "clean"]) {
			provider.respondTo("git", OK);
		}

		await restorer.restore("p-1", sandbox);

		const execs = provider.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail);
		expect(execs).toEqual([
			"test -d .git",
			`${SAFE} init`,
			`${SAFE} fetch https://t:${JWT}@org.code.storage/wandit/p-1.git main`,
			`${SAFE} reset --hard FETCH_HEAD`,
			`${SAFE} clean -fd`,
		]);
	});

	it("masks the JWT in an error message when git echoes the URL", async () => {
		const provider = new FakeSandboxProvider();
		const restorer = new CodeStorageRepoRestorer(fakeGitStore(), fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		provider.respondTo("test", OK);
		provider.respondTo("git", {
			exitCode: 128,
			stderr: `fatal: unable to access 'https://t:${JWT}@org.code.storage/wandit/p-1.git': 401`,
			stdout: "",
		});

		const failure = await restorer
			.restore("p-1", sandbox)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(RepoRestoreError);
		// SAFETY: toBeInstanceOf above proves the error type.
		const message = (failure as RepoRestoreError).message;
		expect(message).not.toContain(JWT);
		expect(message).toContain("***");
	});
});
