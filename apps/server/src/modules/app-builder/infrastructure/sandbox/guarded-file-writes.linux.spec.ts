import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SandboxReader } from "../../domain/ports/sandbox-provider";
import {
	applyGuardedWrites,
	type GuardedFileChange,
	type GuardedWriteRefusal,
	stageGuardedWrites,
} from "./guarded-file-writes";

// The guarded write script uses GNU coreutils flags (realpath -e, mv -T,
// chmod --reference), so this spec runs on Linux only. CI runs on ubuntu-latest.
const IS_LINUX = process.platform === "linux";

/** Runs the script like the sandbox does, but on this machine. The staged files go to the local /tmp. */
function localWriter(
	worktree: string,
): Pick<SandboxReader, "exec" | "workspaceDir" | "writeFiles"> {
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
		workspaceDir: worktree,
		writeFiles: async (files) => {
			for (const file of files) {
				writeFileSync(file.path, file.content);
			}
		},
	};
}

/** One staged write and the state of the disk after it. */
type GuardedWriteCase = {
	label: string;
	changes: GuardedFileChange[];
	/** The refusal that the call returns, or null when every change lands. */
	refusal: GuardedWriteRefusal | null;
	/** File content after the call, by path relative to the temp root. Null: the path must not exist. */
	files: Record<string, string | null>;
	/** Permission bits after the call, by path relative to the temp root. */
	modes?: Record<string, number>;
};

describe.skipIf(!IS_LINUX)("applyGuardedWrites on a real worktree", () => {
	// The temp root holds `workspace` (the worktree) and the files outside it.
	let root = "";

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "guarded-writes-"));
		const worktree = join(root, "workspace");
		mkdirSync(join(root, "outside"));
		writeFileSync(join(root, "outside.txt"), "outside\n");
		mkdirSync(join(worktree, "src", "dir"), { recursive: true });
		writeFileSync(join(worktree, "src", "old.ts"), "old\n");
		writeFileSync(join(worktree, "run.sh"), "#!/bin/sh\necho 1\n");
		chmodSync(join(worktree, "run.sh"), 0o755);
		symlinkSync("../outside", join(worktree, "linked"));
		symlinkSync("../../outside.txt", join(worktree, "src", "link.ts"));
	});

	afterEach(() => {
		rmSync(root, { force: true, recursive: true });
	});

	it.each<GuardedWriteCase>([
		{
			// The good first change proves that the check pass refuses before any write.
			changes: [
				{ content: "first\n", path: "src/first.ts" },
				{ content: "x\n", path: "linked/x.ts" },
			],
			files: { "outside/x.ts": null, "workspace/src/first.ts": null },
			label: "refuses a path under a symlinked folder and writes nothing",
			refusal: { pass: "check", path: "linked/x.ts" },
		},
		{
			changes: [{ content: "x\n", path: "src/link.ts" }],
			files: { "outside.txt": "outside\n" },
			label: "refuses a symlink at the path",
			refusal: { pass: "check", path: "src/link.ts" },
		},
		{
			changes: [{ content: "x\n", path: "src/dir" }],
			files: {},
			label: "refuses a folder at the path",
			refusal: { pass: "check", path: "src/dir" },
		},
		{
			// The first change makes a file where the second change needs a folder. Only the apply pass sees it.
			// The first file stays, so the caller must undo after an apply-pass refusal.
			changes: [
				{ content: "a\n", path: "src/a" },
				{ content: "b\n", path: "src/a/b.ts" },
			],
			files: { "workspace/src/a": "a\n" },
			label: "refuses in the apply pass after an earlier change of the call",
			refusal: { pass: "apply", path: "src/a/b.ts" },
		},
		{
			changes: [{ content: "x\n", path: "-rf $(touch pwned) a.ts" }],
			files: {
				"workspace/-rf $(touch pwned) a.ts": "x\n",
				"workspace/pwned": null,
			},
			label: "writes shell text, a space, and a leading dash as a literal name",
			refusal: null,
		},
		{
			changes: [{ delete: true, path: "src/old.ts" }],
			files: { "workspace/src/old.ts": null },
			label: "deletes a file",
			refusal: null,
		},
		{
			changes: [
				{ content: "#!/bin/sh\necho 2\n", path: "run.sh" },
				{ content: "new\n", path: "src/new/deep.ts" },
			],
			files: {
				"workspace/run.sh": "#!/bin/sh\necho 2\n",
				"workspace/src/new/deep.ts": "new\n",
			},
			label: "keeps the mode of a changed executable and gives a new file 644",
			modes: { "workspace/run.sh": 0o755, "workspace/src/new/deep.ts": 0o644 },
			refusal: null,
		},
	])("$label", async ({ changes, files, modes = {}, refusal }) => {
		const writer = localWriter(join(root, "workspace"));
		const staging = await stageGuardedWrites(writer, changes);
		const result = await applyGuardedWrites(writer, staging, changes);

		expect(result).toEqual(refusal);
		for (const [path, content] of Object.entries(files)) {
			const fullPath = join(root, path);
			if (content === null) {
				expect(existsSync(fullPath)).toBe(false);
			} else {
				expect(readFileSync(fullPath, "utf8")).toBe(content);
			}
		}
		for (const [path, mode] of Object.entries(modes)) {
			// The low 9 bits of `st_mode` are the permission bits.
			expect(statSync(join(root, path)).mode & 0o777).toBe(mode);
		}
	});
});
