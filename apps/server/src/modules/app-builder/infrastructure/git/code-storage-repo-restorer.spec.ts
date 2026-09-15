import { describe, expect, it, vi } from "vitest";

import type { GitStore } from "../../domain/ports/git-store";
import { FakeSandboxProvider } from "../sandbox/fake-sandbox.provider";
import {
	CodeStorageRepoRestorer,
	RepoRestoreError,
} from "./code-storage-repo-restorer";
import { SANDBOX_REPO_DIR } from "./sandbox-git";

const JWT = "header.payload.signature";
const REMOTE = "https://org.code.storage/wandit/p-1.git";

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

function fakeGitStore(): GitStore {
	return {
		deleteRepository: vi.fn(async () => undefined),
		ensureRepository: vi.fn(async () => ({ remoteUrl: REMOTE })),
		issueCredential: vi.fn(async () => ({
			expiresAt: new Date(Date.now() + 600_000),
			password: JWT,
			remoteUrl: REMOTE,
			username: "t",
		})),
	};
}

const OK = { exitCode: 0, stderr: "", stdout: "" };

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

	it("pulls main when the sandbox already has .git", async () => {
		const provider = new FakeSandboxProvider();
		const restorer = new CodeStorageRepoRestorer(fakeGitStore(), fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		provider.respondTo("test", OK);
		provider.respondTo("git", OK);

		await restorer.restore("p-1", sandbox);

		const execs = provider.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail);
		expect(execs).toEqual([
			"test -d .git",
			`git pull https://t:${JWT}@org.code.storage/wandit/p-1.git main`,
		]);
	});

	it(`clones into ${SANDBOX_REPO_DIR} when the directory is empty`, async () => {
		const provider = new FakeSandboxProvider();
		const restorer = new CodeStorageRepoRestorer(fakeGitStore(), fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		provider.respondTo("test", { exitCode: 1, stderr: "", stdout: "" });
		provider.respondTo("git", OK);

		await restorer.restore("p-1", sandbox);

		const execs = provider.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail);
		expect(execs).toEqual([
			"test -d .git",
			`git clone https://t:${JWT}@org.code.storage/wandit/p-1.git ${SANDBOX_REPO_DIR}`,
		]);
	});

	it(`rebuilds the worktree in place when the template occupies ${SANDBOX_REPO_DIR}`, async () => {
		const provider = new FakeSandboxProvider();
		const restorer = new CodeStorageRepoRestorer(fakeGitStore(), fakeCommits());
		const sandbox = await provider.getOrCreate("p-1", CREATE_OPTIONS);
		// The template init already wrote files; the repo has no .git yet.
		await sandbox.writeFiles([
			{ content: "{}", path: `${SANDBOX_REPO_DIR}/package.json` },
		]);
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
			"git init",
			`git fetch https://t:${JWT}@org.code.storage/wandit/p-1.git main`,
			"git reset --hard FETCH_HEAD",
			"git clean -fd",
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
