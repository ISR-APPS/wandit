import {
	BadRequestException,
	ConflictException,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	listVersionsResponseSchema,
	restoreVersionResponseSchema,
	versionDiffResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { GitStore, RepoRestorer } from "../../domain/ports/git-store";
import {
	versionNumstatKey,
	versionPatchKey,
} from "../../infrastructure/git/commit-turn";
import { SANDBOX_REPO_DIR } from "../../infrastructure/git/sandbox-git";
import {
	type AppCommitRow,
	AppCommitsRepository,
	MalformedVersionCursorError,
	type ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { type VersionsObjectStore, VersionsService } from "./versions.service";

const SHA = "a".repeat(40);
const HEAD = "b".repeat(40);
const NEW_SHA = "c".repeat(40);
const JWT = "header.payload.signature";
const REMOTE = "https://org.code.storage/wandit/p-1.git";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

const OK = { exitCode: 0, stderr: "", stdout: "" };

function commitRow(overrides?: Partial<AppCommitRow>): AppCommitRow {
	// SAFETY: the object covers every column the service maps.
	return {
		chatId: "chat-1",
		createdAt: new Date("2026-09-14T10:00:00.000Z"),
		id: "row-1",
		message: "Add the hero section",
		messageId: "msg-1",
		numstat: [{ deletions: 1, insertions: 4, path: "src/routes/index.tsx" }],
		organizationId: null,
		parentSha: HEAD,
		patchKey: versionPatchKey("p-1", SHA),
		projectId: "p-1",
		restoredFromSha: null,
		sha: SHA,
		source: "agent",
		turnId: "11111111-1111-4111-8111-111111111111",
		userId: "user-1",
		...overrides,
	} as AppCommitRow;
}

function fixture(options?: {
	branchHead?: string | null;
	commit?: AppCommitRow | null;
	page?: { items: AppCommitRow[]; nextCursor: string | null };
	project?: ScopedAppProject | null;
	/** CAS answer of `upsertBranchHead`; default true. */
	upsertOk?: boolean;
}) {
	const objects = new Map<string, string | Uint8Array>();
	const store: VersionsObjectStore = {
		getBytes: async (key: string) => {
			const stored = objects.get(key);
			if (stored === undefined) {
				return null;
			}
			return typeof stored === "string"
				? new TextEncoder().encode(stored)
				: stored;
		},
		putPatch: async (key: string, body: string | Uint8Array) => {
			objects.set(key, body);
		},
	};

	// SAFETY: every method the service calls is replaced by a vi.fn below;
	// the empty db object is never reached.
	const appCommits = new AppCommitsRepository({} as Database);
	appCommits.findBranch = vi.fn(async () =>
		options?.branchHead === undefined
			? { headSha: HEAD }
			: options.branchHead === null
				? null
				: { headSha: options.branchHead },
	);
	appCommits.findBySha = vi.fn(async () =>
		options?.commit === undefined ? commitRow() : options.commit,
	);
	appCommits.findScopedProject = vi.fn(async () =>
		options?.project === undefined ? PROJECT : options.project,
	);
	appCommits.insert = vi.fn(async (row) => commitRow(row));
	appCommits.listByProject = vi.fn(
		async () => options?.page ?? { items: [commitRow()], nextCursor: null },
	);
	appCommits.upsertBranchHead = vi.fn(async () => options?.upsertOk ?? true);

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

	// The fake restorer consumes the same exec slots the real one does on a
	// warm sandbox: `test -d .git` then `git pull`.
	const repoRestorer: RepoRestorer = {
		restore: vi.fn(async (_projectId: string, sandbox) => {
			await sandbox.exec("test", ["-d", ".git"], { cwd: SANDBOX_REPO_DIR });
			await sandbox.exec("git", ["pull", "url", "main"], {
				cwd: SANDBOX_REPO_DIR,
			});
		}),
	};

	const sandboxes = new FakeSandboxProvider();
	const turnLock = new FakeTurnLock();
	const service = new VersionsService(
		appCommits,
		sandboxes,
		turnLock,
		gitStore,
		repoRestorer,
		store,
	);

	return { appCommits, objects, repoRestorer, sandboxes, service, turnLock };
}

/** Scripts the exec queue for one restore: pull → read-tree → clean → commitTurn. */
function scriptRestore(
	provider: FakeSandboxProvider,
	options?: { mergeBase?: { exitCode: number } },
): void {
	provider.respondTo("test", OK); // restorer's `.git` check
	provider.respondTo("git", OK); // restorer pull
	provider.respondTo("git", OK); // read-tree -u --reset
	provider.respondTo("git", OK); // clean -fd
	provider.respondTo("git", OK); // add -A
	provider.respondTo("git", { ...OK, stdout: "Restore to bbbbbbb\n" }); // log
	provider.respondTo("git", OK); // commit
	provider.respondTo("git", OK); // tag -f
	provider.respondTo("git", { ...OK, stdout: `${NEW_SHA}\n` }); // rev-parse HEAD
	provider.respondTo("git", { ...OK, stdout: `${HEAD}\n` }); // rev-parse HEAD~1
	provider.respondTo("git", { ...OK, stdout: "2\t0\tsrc/App.tsx\n" }); // numstat
	provider.respondTo("git", { ...OK, stdout: "diff --git a/src/App.tsx\n" });
	provider.respondTo("git", OK); // push
	if (options?.mergeBase !== undefined) {
		provider.respondTo("git", {
			exitCode: options.mergeBase.exitCode,
			stderr: "",
			stdout: "",
		});
	}
}

describe("VersionsService.list", () => {
	it("answers the contract and pages through the repository", async () => {
		const { appCommits, service } = fixture({
			page: { items: [commitRow()], nextCursor: "next-1" },
		});

		const body = await service.list(SCOPE, "p-1", { limit: 50 });

		expect(appCommits.listByProject).toHaveBeenCalledWith("p-1", {
			cursor: undefined,
			limit: 50,
		});
		const parsed = listVersionsResponseSchema.parse(body);
		expect(parsed.items[0]?.sha).toBe(SHA);
		expect(parsed.nextCursor).toBe("next-1");
	});

	it("answers 404 for a v1 project", async () => {
		const { service } = fixture({
			project: { ...PROJECT, engine: "v1_page" },
		});

		await expect(service.list(SCOPE, "p-1", { limit: 50 })).rejects.toEqual(
			expect.any(NotFoundException),
		);
	});

	it("answers 404 for a project outside the caller's scope", async () => {
		const { service } = fixture({ project: null });

		await expect(service.list(SCOPE, "p-1", { limit: 50 })).rejects.toEqual(
			expect.any(NotFoundException),
		);
	});

	it("answers 400 for a malformed cursor", async () => {
		const { appCommits, service } = fixture();
		appCommits.listByProject = vi.fn(async () => {
			throw new MalformedVersionCursorError();
		});

		await expect(
			service.list(SCOPE, "p-1", { cursor: "not-a-cursor", limit: 50 }),
		).rejects.toEqual(expect.any(BadRequestException));
	});
});

describe("VersionsService.diff", () => {
	it("answers the stored patch and numstat of one commit", async () => {
		const { objects, service } = fixture();
		objects.set(versionPatchKey("p-1", SHA), "diff --git a/src/App.tsx\n");
		objects.set(
			versionNumstatKey("p-1", SHA),
			JSON.stringify([{ deletions: 0, insertions: 2, path: "src/App.tsx" }]),
		);

		const body = await service.diff(SCOPE, "p-1", SHA);

		const parsed = versionDiffResponseSchema.parse(body);
		expect(parsed.sha).toBe(SHA);
		expect(parsed.patch).toBe("diff --git a/src/App.tsx\n");
		expect(parsed.numstat).toEqual([
			{ deletions: 0, insertions: 2, path: "src/App.tsx" },
		]);
	});

	it("answers 404 for an unknown commit or a missing patch", async () => {
		const { service } = fixture({ commit: null });
		await expect(service.diff(SCOPE, "p-1", SHA)).rejects.toEqual(
			expect.any(NotFoundException),
		);

		const { service: noPatch } = fixture({ commit: commitRow() });
		await expect(noPatch.diff(SCOPE, "p-1", SHA)).rejects.toEqual(
			expect.any(NotFoundException),
		);
	});
});

describe("VersionsService.restore", () => {
	it("answers 409 BUILDER_TURN_ACTIVE while a turn holds the lock", async () => {
		const { service, turnLock } = fixture();
		await turnLock.acquire("p-1", "turn-9", 60_000);

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "BUILDER_TURN_ACTIVE",
		});
		// The failed acquire left the turn's lock entry untouched.
		expect(await turnLock.holder("p-1")).toBe("turn-9");
	});

	it("answers 409 VERSION_CONFLICT on a stale expected head", async () => {
		const { service } = fixture({ branchHead: "d".repeat(40) });

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "VERSION_CONFLICT",
		});
	});

	it("answers 404 for an unknown commit", async () => {
		const { service } = fixture({ commit: null });

		await expect(
			service.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }),
		).rejects.toEqual(expect.any(NotFoundException));
	});

	it("writes a copy-forward restore commit on top of the head", async () => {
		const { appCommits, objects, repoRestorer, sandboxes, service, turnLock } =
			fixture();
		scriptRestore(sandboxes);

		const body = await service.restore(SCOPE, "p-1", SHA, {
			expectedHeadSha: HEAD,
		});

		const parsed = restoreVersionResponseSchema.parse(body);
		expect(parsed.commit.sha).toBe(NEW_SHA);
		expect(repoRestorer.restore).toHaveBeenCalledWith("p-1", expect.anything());

		const execs = sandboxes.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail ?? "");
		// read-tree leaves untracked files; clean runs before `add -A` sweeps.
		const readTree = execs.indexOf(`git read-tree -u --reset ${SHA}`);
		const clean = execs.indexOf("git clean -fd");
		const add = execs.indexOf("git add -A");
		expect(readTree).toBeGreaterThanOrEqual(0);
		expect(clean).toBe(readTree + 1);
		expect(add).toBe(clean + 1);
		expect(execs.some((line) => line.startsWith("git push "))).toBe(true);

		expect(appCommits.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				messageId: expect.stringMatching(/^restore-/),
				parentSha: HEAD,
				restoredFromSha: SHA,
				source: "restore",
				turnId: null,
			}),
		);
		expect(objects.has(versionPatchKey("p-1", NEW_SHA))).toBe(true);
		// A finished restore frees the project lock for the next turn.
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	it("releases the lock when the restore commit fails", async () => {
		const { sandboxes, service, turnLock } = fixture({ upsertOk: false });
		// The head CAS loses; the stored head (HEAD) is not an ancestor of the
		// new commit, so commitTurn surfaces a VersionConflictError.
		scriptRestore(sandboxes, { mergeBase: { exitCode: 1 } });

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "VERSION_CONFLICT",
		});
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	it("answers 500 when the v2_app row has no template", async () => {
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { sandboxes, service, turnLock } = fixture({
			project: { ...PROJECT, framework: null },
		});

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD })
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(InternalServerErrorException);
		expect(logError).toHaveBeenCalledWith(expect.stringContaining("p-1"));
		// No sandbox work ran, and the lock is free again.
		expect(sandboxes.calls.some((call) => call.method === "getOrCreate")).toBe(
			false,
		);
		expect(await turnLock.holder("p-1")).toBeNull();
		logError.mockRestore();
	});
});
