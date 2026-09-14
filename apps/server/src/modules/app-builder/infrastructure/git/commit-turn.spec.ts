import { describe, expect, it, vi } from "vitest";

import type { GitStore } from "../../domain/ports/git-store";
import type {
	SandboxExecResult,
	SandboxHandle,
} from "../../domain/ports/sandbox-provider";
import type { AppCommitRow } from "../persistence/app-commits.repository";
import { VersionConflictError } from "../persistence/app-commits.repository";
import { FakeSandboxProvider } from "../sandbox/fake-sandbox.provider";
import {
	type CommitTurnDeps,
	CommitTurnError,
	type CommitTurnInput,
	type CommitTurnStore,
	commitTurn,
	versionNumstatKey,
	versionPatchKey,
} from "./commit-turn";

const SHA = "a".repeat(40);
const PARENT = "b".repeat(40);
const STORED_HEAD = "d".repeat(40);
const JWT = "header.payload.signature";
const REMOTE = "https://org.code.storage/wandit/p-1.git";

const INPUT: CommitTurnInput = {
	projectId: "p-1",
	userId: "user-1",
	organizationId: null,
	chatId: "chat-1",
	turnId: "turn-1",
	messageId: "msg-1",
	source: "agent",
	summary: "Add the hero section",
};

const OK = { exitCode: 0, stderr: "", stdout: "" };

type CommittedRow = Parameters<CommitTurnStore["insert"]>[0];

function fixture(options?: {
	/** CAS answers in call order; later calls answer `true` when it runs out. */
	upsertResults?: boolean[];
	/** `app_branches.headSha` a failed CAS then reads; null means no row. */
	storedHead?: string | null;
}) {
	const provider = new FakeSandboxProvider();
	const inserted: CommittedRow[] = [];
	const headWrites: {
		headSha: string;
		expectedHeadSha: string | null;
	}[] = [];
	const puts = new Map<string, string | Uint8Array>();
	const upsertResults = [...(options?.upsertResults ?? [true])];

	const appCommits: CommitTurnStore = {
		findBranch: vi.fn(async () =>
			options?.storedHead === undefined
				? { headSha: PARENT }
				: options.storedHead === null
					? null
					: { headSha: options.storedHead },
		),
		insert: vi.fn(async (row: CommittedRow) => {
			inserted.push(row);
			// SAFETY: the spec only reads the fields it sets here.
			return row as AppCommitRow;
		}),
		upsertBranchHead: vi.fn(
			async (
				_projectId: string,
				_name: string,
				head: {
					headSha: string;
					expectedHeadSha: string | null;
				},
			) => {
				headWrites.push(head);
				return upsertResults.shift() ?? true;
			},
		),
	};

	const gitStore: GitStore = {
		deleteRepository: vi.fn(async () => undefined),
		ensureRepository: vi.fn(async () => ({ remoteUrl: REMOTE })),
		issueCredential: vi.fn(async () => ({
			expiresAt: new Date(Date.now() + 600_000),
			password: JWT,
			remoteUrl: REMOTE,
			username: "t",
		})),
	};

	const deps: CommitTurnDeps = {
		gitStore,
		appCommits,
		putPatch: vi.fn(async (key: string, body: string | Uint8Array) => {
			puts.set(key, body);
		}),
	};

	return { appCommits, deps, headWrites, inserted, provider, puts, gitStore };
}

async function fixtureSandbox(
	provider: FakeSandboxProvider,
): Promise<SandboxHandle> {
	return provider.getOrCreate("p-1", {
		devCommand: "pnpm dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		templateVersion: "web-app@1.0.0",
		ownerUserId: "user-1",
		organizationId: null,
	});
}

/** Scripts one full happy-path commit for the fake `exec` queue. */
function scriptCommit(
	provider: FakeSandboxProvider,
	options?: {
		headMessage?: string;
		parent?: SandboxExecResult;
		pushes?: { exitCode: number; stderr?: string }[];
		patch?: string;
		/** `git merge-base --is-ancestor` answer; scripted after the pushes. */
		mergeBase?: SandboxExecResult;
	},
): void {
	provider.respondTo("git", OK); // add -A
	provider.respondTo("git", {
		exitCode: 0,
		stderr: "",
		stdout: options?.headMessage ?? "Add the hero section\n",
	}); // log -1 --format=%B
	provider.respondTo("git", OK); // commit
	provider.respondTo("git", OK); // tag -f
	provider.respondTo("git", { ...OK, stdout: `${SHA}\n` }); // rev-parse HEAD
	provider.respondTo(
		"git",
		options?.parent ?? { ...OK, stdout: `${PARENT}\n` },
	); // rev-parse HEAD~1
	provider.respondTo("git", {
		...OK,
		stdout: "4\t1\tsrc/routes/index.tsx\n-\t-\tpublic/logo.png\n",
	}); // show --numstat
	provider.respondTo("git", {
		...OK,
		stdout: options?.patch ?? "diff --git a/src/routes/index.tsx ...\n",
	}); // show --format=
	for (const push of options?.pushes ?? [{ exitCode: 0 }]) {
		provider.respondTo("git", {
			exitCode: push.exitCode,
			stderr: push.stderr ?? "",
			stdout: "",
		});
	}
	if (options?.mergeBase !== undefined) {
		provider.respondTo("git", options.mergeBase);
	}
}

function execLog(provider: FakeSandboxProvider): string[] {
	return provider.calls
		.filter((call) => call.method === "exec")
		.map((call) => call.detail ?? "");
}

// The patch is stored as capped bytes; anything else under the key is a
// spec bug.
function storedPatch(
	puts: Map<string, string | Uint8Array>,
	key: string,
): Uint8Array {
	const value = puts.get(key);
	if (value instanceof Uint8Array) {
		return value;
	}
	throw new Error(`no stored patch bytes for ${key}`);
}

describe("commitTurn", () => {
	it("runs the git commands in order and writes row, patches, and head", async () => {
		const { appCommits, deps, headWrites, inserted, provider, puts } =
			fixture();
		scriptCommit(provider);
		const sandbox = await fixtureSandbox(provider);

		const result = await commitTurn(sandbox, deps, INPUT);

		const execs = execLog(provider);
		expect(execs[0]).toBe("git add -A");
		expect(execs[1]).toBe("git log -1 --format=%B");
		// The fake joins command and args with a space; a real exec passes
		// the message as one argv entry.
		expect(execs[2]).toBe(
			"git -c user.name=wandit -c user.email=builder@wandit.dev commit --allow-empty -m Add the hero section -m Wandit-Message: msg-1 -m Wandit-Chat: chat-1",
		);
		expect(execs[3]).toBe("git tag -f msg/msg-1");
		expect(execs[4]).toBe("git rev-parse HEAD");
		expect(execs[5]).toBe("git rev-parse HEAD~1");
		expect(execs[6]).toBe("git show --numstat --format= HEAD");
		expect(execs[7]).toBe("git show --format= HEAD");
		expect(execs[8]).toBe(
			`git push https://t:${JWT}@org.code.storage/wandit/p-1.git HEAD:main`,
		);

		expect(result.sha).toBe(SHA);
		expect(result.parentSha).toBe(PARENT);
		expect(result.patchKey).toBe("git/p-1/patches/".concat(SHA, ".diff"));
		expect(result.numstat).toEqual([
			{ deletions: 1, insertions: 4, path: "src/routes/index.tsx" },
			{ deletions: 0, insertions: 0, path: "public/logo.png" },
		]);

		expect(
			new TextDecoder().decode(storedPatch(puts, versionPatchKey("p-1", SHA))),
		).toBe("diff --git a/src/routes/index.tsx ...\n");
		expect(puts.get(versionNumstatKey("p-1", SHA))).toBe(
			JSON.stringify(result.numstat),
		);

		expect(appCommits.insert).toHaveBeenCalledOnce();
		expect(inserted[0]).toMatchObject({
			chatId: "chat-1",
			messageId: "msg-1",
			parentSha: PARENT,
			projectId: "p-1",
			sha: SHA,
			source: "agent",
			turnId: "turn-1",
		});
		expect(headWrites).toEqual([
			{
				expectedHeadSha: PARENT,
				headSha: SHA,
				organizationId: null,
				userId: "user-1",
			},
		]);
	});

	it("does not commit twice when the message trailer is on HEAD", async () => {
		const { deps, provider } = fixture();
		scriptCommit(provider, {
			headMessage: "Add the hero section\n\nWandit-Message: msg-1\n",
		});
		const sandbox = await fixtureSandbox(provider);

		await commitTurn(sandbox, deps, INPUT);

		const execs = execLog(provider);
		// `git commit` is skipped; `tag -f` still re-points the tag.
		expect(execs.filter((line) => line.includes("git -c"))).toHaveLength(0);
		expect(execs[2]).toBe("git tag -f msg/msg-1");
	});

	it("records a null parent on the root commit", async () => {
		const { deps, inserted, provider } = fixture();
		scriptCommit(provider, {
			parent: { exitCode: 128, stderr: "", stdout: "" },
		});
		const sandbox = await fixtureSandbox(provider);

		const result = await commitTurn(sandbox, deps, INPUT);

		expect(result.parentSha).toBeNull();
		expect(inserted[0]?.parentSha).toBeNull();
	});

	it("creates the repository and retries once when the first push fails", async () => {
		const { deps, gitStore, provider } = fixture();
		scriptCommit(provider, {
			pushes: [{ exitCode: 128, stderr: "no such repo" }, { exitCode: 0 }],
		});
		const sandbox = await fixtureSandbox(provider);

		const result = await commitTurn(sandbox, deps, INPUT);

		expect(gitStore.ensureRepository).toHaveBeenCalledOnce();
		expect(result.sha).toBe(SHA);
	});

	it("throws CommitTurnError when both pushes fail and redacts the URL", async () => {
		const { deps, provider } = fixture();
		scriptCommit(provider, {
			pushes: [
				{ exitCode: 128, stderr: "no such repo" },
				{
					exitCode: 128,
					stderr: `denied to https://t:${JWT}@org.code.storage/wandit/p-1.git`,
				},
			],
		});
		const sandbox = await fixtureSandbox(provider);

		const failure = await commitTurn(sandbox, deps, INPUT).catch(
			(error: unknown) => error,
		);

		expect(failure).toBeInstanceOf(CommitTurnError);
		// SAFETY: toBeInstanceOf above proves the error type.
		const message = (failure as CommitTurnError).message;
		expect(message).not.toContain(JWT);
		expect(message).toContain("***");
		// The failed push's stderr is part of the error, credential masked.
		expect(message).toContain("denied to https://t:***@org.code.storage");
	});

	it("caps the stored patch at 1 MiB of bytes", async () => {
		const { deps, provider, puts } = fixture();
		scriptCommit(provider, { patch: "x".repeat(1_500_000) });
		const sandbox = await fixtureSandbox(provider);

		await commitTurn(sandbox, deps, INPUT);

		expect(storedPatch(puts, versionPatchKey("p-1", SHA))).toHaveLength(
			1_048_576,
		);
	});

	it("caps a multibyte patch at 1 MiB of bytes, not UTF-16 units", async () => {
		const { deps, provider, puts } = fixture();
		// 400 000 euro signs are 1 200 000 UTF-8 bytes but only 400 000
		// UTF-16 code units; a code-unit slice would store the patch whole.
		scriptCommit(provider, { patch: "€".repeat(400_000) });
		const sandbox = await fixtureSandbox(provider);

		await commitTurn(sandbox, deps, INPUT);

		expect(storedPatch(puts, versionPatchKey("p-1", SHA))).toHaveLength(
			1_048_576,
		);
	});

	it("advances the head when the stored head is an ancestor of the pushed commit", async () => {
		const { appCommits, deps, headWrites, provider } = fixture({
			storedHead: STORED_HEAD,
			upsertResults: [false, true],
		});
		scriptCommit(provider, { mergeBase: OK });
		const sandbox = await fixtureSandbox(provider);

		const result = await commitTurn(sandbox, deps, INPUT);

		expect(result.sha).toBe(SHA);
		// The recovery exec proves the stored head sits inside the pushed
		// history before the second CAS.
		expect(execLog(provider)).toContain(
			`git merge-base --is-ancestor ${STORED_HEAD} ${SHA}`,
		);
		expect(appCommits.upsertBranchHead).toHaveBeenCalledTimes(2);
		expect(headWrites[1]).toEqual({
			expectedHeadSha: STORED_HEAD,
			headSha: SHA,
			organizationId: null,
			userId: "user-1",
		});
	});

	it("throws VersionConflictError when the stored head is not an ancestor", async () => {
		const { appCommits, deps, provider } = fixture({
			storedHead: STORED_HEAD,
			upsertResults: [false],
		});
		scriptCommit(provider, {
			mergeBase: { exitCode: 1, stderr: "", stdout: "" },
		});
		const sandbox = await fixtureSandbox(provider);

		await expect(commitTurn(sandbox, deps, INPUT)).rejects.toBeInstanceOf(
			VersionConflictError,
		);
		expect(appCommits.upsertBranchHead).toHaveBeenCalledTimes(1);
	});

	it("throws VersionConflictError when the recovery CAS also loses", async () => {
		const { deps, provider } = fixture({
			storedHead: STORED_HEAD,
			upsertResults: [false, false],
		});
		scriptCommit(provider, { mergeBase: OK });
		const sandbox = await fixtureSandbox(provider);

		await expect(commitTurn(sandbox, deps, INPUT)).rejects.toBeInstanceOf(
			VersionConflictError,
		);
	});

	it("throws VersionConflictError when the head CAS loses and no head is stored", async () => {
		const { deps, provider } = fixture({
			storedHead: null,
			upsertResults: [false],
		});
		scriptCommit(provider);
		const sandbox = await fixtureSandbox(provider);

		await expect(commitTurn(sandbox, deps, INPUT)).rejects.toBeInstanceOf(
			VersionConflictError,
		);
	});

	it("writes the restore trailer and no chat trailer for a restore commit", async () => {
		const { deps, inserted, provider } = fixture();
		scriptCommit(provider);
		const sandbox = await fixtureSandbox(provider);

		await commitTurn(sandbox, deps, {
			...INPUT,
			chatId: null,
			messageId: "restore-9",
			restoredFromSha: PARENT,
			source: "restore",
			turnId: null,
		});

		const commitLine = execLog(provider).find((line) =>
			line.includes("git -c user.name=wandit"),
		);
		expect(commitLine).toContain("Wandit-Message: restore-9");
		expect(commitLine).toContain(`Wandit-Restore-From: ${PARENT}`);
		expect(commitLine).not.toContain("Wandit-Chat");

		expect(inserted[0]).toMatchObject({
			chatId: null,
			restoredFromSha: PARENT,
			source: "restore",
			turnId: null,
		});
	});
});
