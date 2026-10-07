import {
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
import type { SandboxExecResult } from "../../domain/ports/sandbox-provider";
import {
	CommitTurnError,
	versionNumstatKey,
	versionPatchKey,
} from "../../infrastructure/git/commit-turn";
import type { AppBackendRow } from "../../infrastructure/persistence/app-backends.repository";
import {
	type AppCommitRow,
	AppCommitsRepository,
	type ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type { BuilderTurnRow } from "../../infrastructure/persistence/builder-turns.repository";
import type { TurnProjectRow } from "../../infrastructure/persistence/turn-project.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../../infrastructure/sandbox/fake-sandbox.provider";
import { type VersionsObjectStore, VersionsService } from "./versions.service";

const SHA = "a".repeat(40);
const HEAD = "b".repeat(40);
const NEW_SHA = "c".repeat(40);
const WIP_SHA = "e".repeat(40);
const JWT = "header.payload.signature";
const REMOTE = "https://org.code.storage/wandit/p-1.git";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
// A TEST-NET-3 address (RFC 5737): it never names a real client.
const IP = "203.0.113.7";
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

const BACKEND: AppBackendRow = {
	anonKey: "anon-key-1",
	dbHost: "db.abcdefghijklmnopqrst.supabase.co",
	failureCode: null,
	id: "backend-1",
	orgId: "sb-org",
	organizationId: null,
	projectId: "p-1",
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	requestKey: "request-1",
	status: "active",
	triggerRunId: null,
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
	/** True when a turn of the project waits for a user answer. */
	turnWaits?: boolean;
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

	// The fake restorer consumes one `test` slot and one `git` slot, so the
	// git answers below line up with the restore steps after it.
	const repoRestorer: RepoRestorer = {
		restore: vi.fn(async (_projectId: string, sandbox) => {
			await sandbox.exec("test", ["-d", ".git"], { cwd: FAKE_WORKSPACE_DIR });
			await sandbox.exec("git", ["pull", "url", "main"], {
				cwd: FAKE_WORKSPACE_DIR,
			});
		}),
	};

	// The sandbox start reads the projects row again for its egress hosts.
	const project = options?.project === undefined ? PROJECT : options.project;
	const projects = {
		findForTurn: async (): Promise<TurnProjectRow | null> =>
			project === null
				? null
				: {
						engine: "v2_app",
						framework: project.framework,
						languages: ["en"],
						networkAllowedHosts: ["api.stripe.com"],
						organizationId: project.organizationId,
						templateVersion: project.templateVersion,
						userId: project.userId,
					},
	};
	const backends = { findByProjectId: async () => BACKEND };

	const sandboxes = new FakeSandboxProvider();
	const turnLock = new FakeTurnLock();
	const turns = {
		findWaitingForUser: vi.fn(async () =>
			// SAFETY: the service reads only whether a row exists.
			options?.turnWaits ? ({ id: "turn-8" } as BuilderTurnRow) : null,
		),
	};
	const service = new VersionsService(
		appCommits,
		sandboxes,
		turnLock,
		gitStore,
		repoRestorer,
		store,
		projects,
		backends,
		turns,
		{ record: async () => undefined },
	);

	return { appCommits, objects, repoRestorer, sandboxes, service, turnLock };
}

/** Scripts the nine git answers of one `commitTurn` that makes `sha` on `parentSha`. */
function scriptCommit(
	provider: FakeSandboxProvider,
	sha: string,
	parentSha: string,
): void {
	provider.respondTo("git", OK); // add -A
	provider.respondTo("git", { ...OK, stdout: "Add the hero section\n" }); // log
	provider.respondTo("git", OK); // commit
	provider.respondTo("git", OK); // tag -f
	provider.respondTo("git", { ...OK, stdout: `${sha}\n` }); // rev-parse HEAD
	provider.respondTo("git", { ...OK, stdout: `${parentSha}\n` }); // rev-parse HEAD~1
	provider.respondTo("git", { ...OK, stdout: "2\t0\tsrc/App.tsx\n" }); // numstat
	provider.respondTo("git", { ...OK, stdout: "diff --git a/src/App.tsx\n" });
	provider.respondTo("git", OK); // push
}

/**
 * Scripts the exec queue for one restore: `.env` → status → [wip commit] →
 * pull → read-tree → clean → commitTurn → pnpm install.
 */
function scriptRestore(
	provider: FakeSandboxProvider,
	options?: {
		/** True: the status read lists a changed file, so a wip commit runs first. */
		dirtyTree?: boolean;
		/** The `pnpm install` answer; default exit 0. */
		install?: SandboxExecResult;
		mergeBase?: { exitCode: number };
	},
): void {
	provider.respondTo("bash", OK); // the boot's `.env` write waits for the dev port
	// The wip save reads `git status` and HEAD in one `sh` call.
	provider.respondTo("sh", {
		...OK,
		stdout: `${options?.dirtyTree ? " M src/App.tsx\n" : ""}HEAD=${HEAD}\n`,
	});
	if (options?.dirtyTree) {
		scriptCommit(provider, WIP_SHA, HEAD);
	}
	provider.respondTo("test", OK); // restorer's `.git` check
	provider.respondTo("git", OK); // restorer pull
	provider.respondTo("git", OK); // read-tree -u --reset
	provider.respondTo("git", OK); // clean -fd
	scriptCommit(provider, NEW_SHA, options?.dirtyTree ? WIP_SHA : HEAD);
	provider.respondTo("pnpm", options?.install ?? OK);
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
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
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

	// A paused turn resumes with tool results, which cannot carry the restore note.
	it("answers 409 BUILDER_TURN_WAITING while a turn waits for the user", async () => {
		const { service, turnLock } = fixture({ turnWaits: true });

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "BUILDER_TURN_WAITING",
		});
		// The refused restore gave the lock back.
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	it("answers 409 VERSION_CONFLICT on a stale expected head", async () => {
		const { service } = fixture({ branchHead: "d".repeat(40) });

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
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
			service.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP),
		).rejects.toEqual(expect.any(NotFoundException));
	});

	it("writes a copy-forward restore commit on top of the head", async () => {
		const { appCommits, objects, repoRestorer, sandboxes, service, turnLock } =
			fixture();
		scriptRestore(sandboxes);

		const body = await service.restore(
			SCOPE,
			"p-1",
			SHA,
			{ expectedHeadSha: HEAD },
			IP,
		);

		const parsed = restoreVersionResponseSchema.parse(body);
		expect(parsed.commit.sha).toBe(NEW_SHA);
		expect(repoRestorer.restore).toHaveBeenCalledWith("p-1", expect.anything());

		const execs = sandboxes.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail ?? "");
		// read-tree leaves untracked files; clean runs before `add -A` sweeps.
		// `mustRunGit` puts its -c flags between `git` and the subcommand.
		const readTree = execs.findIndex((line) =>
			line.endsWith(` read-tree -u --reset ${SHA}`),
		);
		const clean = execs.findIndex((line) => line.endsWith(" clean -fd"));
		const add = execs.findIndex((line) => line.endsWith(" add -A"));
		expect(readTree).toBeGreaterThanOrEqual(0);
		expect(clean).toBe(readTree + 1);
		expect(add).toBe(clean + 1);
		expect(execs.some((line) => line.includes(" push --no-verify "))).toBe(
			true,
		);

		expect(appCommits.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				messageId: expect.stringMatching(/^restore-/),
				parentSha: HEAD,
				restoredFromSha: SHA,
				source: "restore",
				turnId: null,
			}),
		);
		// A clean tree at the stored head adds no empty "Before restore" version.
		expect(appCommits.insert).toHaveBeenCalledTimes(1);
		expect(objects.has(versionPatchKey("p-1", NEW_SHA))).toBe(true);
		// A finished restore frees the project lock for the next turn.
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	// A failed turn leaves its files uncommitted; the restorer reset deletes them.
	it("saves uncommitted files as a wip version before the reset", async () => {
		const { appCommits, sandboxes, service } = fixture();
		scriptRestore(sandboxes, { dirtyTree: true });

		const body = await service.restore(
			SCOPE,
			"p-1",
			SHA,
			{ expectedHeadSha: HEAD },
			IP,
		);

		expect(restoreVersionResponseSchema.parse(body).commit.sha).toBe(NEW_SHA);
		// The wip version holds the files, and the restore lands on top of it.
		expect(
			vi
				.mocked(appCommits.insert)
				.mock.calls.map(([row]) => [row.source, row.message, row.parentSha]),
		).toEqual([
			["wip", "Before restore", HEAD],
			["restore", `Restore to ${SHA.slice(0, 7)}`, WIP_SHA],
		]);
		const execs = sandboxes.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail ?? "");
		// The wip push ends before the restorer touches the worktree.
		const wipPush = execs.findIndex((line) =>
			line.includes(" push --no-verify "),
		);
		expect(wipPush).toBeGreaterThanOrEqual(0);
		expect(execs.indexOf("git pull url main")).toBeGreaterThan(wipPush);
	});

	it("stops before the reset when the wip save fails", async () => {
		const { appCommits, repoRestorer, sandboxes, service, turnLock } =
			fixture();
		sandboxes.respondTo("bash", OK);
		sandboxes.respondTo("sh", {
			...OK,
			stdout: ` M src/App.tsx\nHEAD=${HEAD}\n`,
		});
		sandboxes.respondTo("git", {
			exitCode: 128,
			stderr: "fatal: Unable to create '.git/index.lock': File exists.",
			stdout: "",
		}); // add -A

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(CommitTurnError);
		// No reset ran, so the uncommitted files are still in the sandbox.
		expect(repoRestorer.restore).not.toHaveBeenCalled();
		expect(appCommits.insert).not.toHaveBeenCalled();
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	// A later turn can remove a package that the restored version imports.
	it("reinstalls packages after the restore commit and keeps the restore when the install fails", async () => {
		const logWarn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		const { sandboxes, service } = fixture();
		scriptRestore(sandboxes, {
			install: {
				exitCode: 1,
				stderr: "",
				stdout:
					"ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with frozen-lockfile",
			},
		});

		const body = await service.restore(
			SCOPE,
			"p-1",
			SHA,
			{ expectedHeadSha: HEAD },
			IP,
		);

		expect(restoreVersionResponseSchema.parse(body).commit.sha).toBe(NEW_SHA);
		const execs = sandboxes.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail ?? "");
		const push = execs.findIndex((line) => line.includes(" push --no-verify "));
		const install = execs.indexOf(
			"pnpm install --frozen-lockfile --prefer-offline",
		);
		expect(install).toBeGreaterThan(push);
		// pnpm prints its error to stdout; the log keeps it with the project id.
		expect(logWarn).toHaveBeenCalledWith(
			expect.stringMatching(/p-1.*ERR_PNPM_OUTDATED_LOCKFILE/),
		);
		logWarn.mockRestore();
	});

	// An API restart stops the refreshes. The project must not stay blocked.
	it("keeps the lock while the restore runs and frees it 2 min after the last refresh", async () => {
		const logWarn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => undefined);
		vi.useFakeTimers();
		try {
			const { repoRestorer, sandboxes, service, turnLock } = fixture();
			scriptRestore(sandboxes);
			// The restore hangs in the restorer, like a slow fetch.
			vi.mocked(repoRestorer.restore).mockImplementation(
				() => new Promise<void>(() => undefined),
			);
			void service.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP);

			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect(await turnLock.holder("p-1")).toMatch(/^restore:/);

			// On SIGTERM the lock client quits Redis, so each refresh rejects.
			turnLock.refresh = async () => {
				throw new Error("Connection is closed.");
			};
			await vi.advanceTimersByTimeAsync(2 * 60_000);
			expect(await turnLock.holder("p-1")).toBeNull();
		} finally {
			vi.useRealTimers();
			logWarn.mockRestore();
		}
	});

	it("starts the sandbox with the egress inputs of a turn and no proxy token", async () => {
		const { sandboxes, service } = fixture();
		scriptRestore(sandboxes);

		await service.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP);

		// A strict start throws without the proxy URL. A policy without the
		// backend and project hosts cuts a running sandbox off from them.
		const options = sandboxes.createOptions[0];
		expect(options).toMatchObject({
			backendUrl: "https://abcdefghijklmnopqrst.supabase.co",
			env: {
				ANTHROPIC_API_KEY: "",
				ANTHROPIC_BASE_URL: expect.stringMatching(
					/^https?:\/\/[^/]+\/api\/v2\/llm$/,
				),
			},
			networkAllowedHosts: ["api.stripe.com"],
		});
		// Security: with no turn, a token in the VM spends LLM credits.
		expect(options?.env).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
	});

	it("boots a mobile project with the Metro command and port", async () => {
		const { sandboxes, service } = fixture({
			project: {
				...PROJECT,
				framework: "mobile-app",
				templateVersion: "mobile-app@1.0.0",
			},
		});
		scriptRestore(sandboxes);

		await service.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP);

		expect(sandboxes.createOptions[0]).toMatchObject({
			devCommand: "pnpm run dev",
			devPort: 8081,
			framework: "mobile-app",
			templateVersion: "mobile-app@1.0.0",
		});
	});

	it("releases the lock when the restore commit fails", async () => {
		const { sandboxes, service, turnLock } = fixture({ upsertOk: false });
		// The head CAS loses; the stored head (HEAD) is not an ancestor of the
		// new commit, so commitTurn surfaces a VersionConflictError.
		scriptRestore(sandboxes, { mergeBase: { exitCode: 1 } });

		const failure = await service
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
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
			.restore(SCOPE, "p-1", SHA, { expectedHeadSha: HEAD }, IP)
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
