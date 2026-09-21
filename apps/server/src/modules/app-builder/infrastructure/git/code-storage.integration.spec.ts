/**
 * Live check of the code.storage round trip (WANDIT-152).
 * Runs only with `V2_CODE_STORAGE_INTEGRATION_TEST=true` plus
 * `CODE_STORAGE_ORG` and `CODE_STORAGE_PRIVATE_KEY` set. It creates one
 * repository, pushes three commits with the real git CLI, clones, and
 * deletes the repository again.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { V2EnvSource } from "../env/v2-env";
import { CodeStorageGitStore } from "./code-storage.git-store";
import { authenticatedRemoteUrl } from "./git-remote-url";

const RUN =
	process.env.V2_CODE_STORAGE_INTEGRATION_TEST === "true" &&
	Boolean(process.env.CODE_STORAGE_ORG) &&
	Boolean(process.env.CODE_STORAGE_PRIVATE_KEY);

const v2Env: V2EnvSource = {
	CODE_STORAGE_ORG: process.env.CODE_STORAGE_ORG,
	CODE_STORAGE_PRIVATE_KEY: process.env.CODE_STORAGE_PRIVATE_KEY,
	// The harness choice is unused by the git store; the type requires it.
	V2_HARNESS: "claude-code",
};

// One CLI call in `dir`; the JWT lives in the remote URL argument only.
// The catch masks `secret` because execFileSync copies the full command
// line into the error message.
function git(dir: string, args: string[], secret?: string): string {
	try {
		return execFileSync("git", args, { cwd: dir, encoding: "utf8" });
	} catch (error) {
		if (secret !== undefined && error instanceof Error) {
			throw new Error(error.message.replaceAll(secret, "***"));
		}
		throw error;
	}
}

describe.skipIf(!RUN)("code.storage integration", () => {
	it("creates a repository, pushes three commits, and clones three back", async () => {
		const projectId = `it-${randomUUID()}`;
		const store = new CodeStorageGitStore(v2Env);
		const workDir = mkdtempSync(join(tmpdir(), "wandit-it-work-"));
		const cloneDir = mkdtempSync(join(tmpdir(), "wandit-it-clone-"));

		try {
			await store.ensureRepository(projectId);
			const credential = await store.issueCredential(projectId, 600);
			const remoteUrl = authenticatedRemoteUrl(
				credential.remoteUrl,
				credential,
			);

			git(workDir, ["init", "-b", "main"]);
			git(workDir, ["config", "user.name", "wandit-test"]);
			git(workDir, ["config", "user.email", "test@wandit.dev"]);
			for (const index of [1, 2, 3]) {
				writeFileSync(join(workDir, "file.txt"), `commit ${index}\n`);
				git(workDir, ["add", "-A"]);
				git(workDir, ["commit", "-m", `commit ${index}`]);
			}
			git(workDir, ["push", remoteUrl, "HEAD:main"], credential.password);

			git(cloneDir, ["clone", remoteUrl, "repo"], credential.password);
			const log = git(join(cloneDir, "repo"), ["log", "--format=%s"]).trim();

			expect(log.split("\n")).toEqual(["commit 3", "commit 2", "commit 1"]);
		} finally {
			await store.deleteRepository(projectId).catch(() => undefined);
			rmSync(workDir, { force: true, recursive: true });
			rmSync(cloneDir, { force: true, recursive: true });
		}
	}, 120_000);
});
