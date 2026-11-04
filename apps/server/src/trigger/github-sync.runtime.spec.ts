import type { GithubSyncErrorCode } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { SandboxExecResult } from "../modules/app-builder/domain/ports/sandbox-provider";
import { SAFE_GIT_CONFIG_ARGS } from "../modules/app-builder/infrastructure/git/sandbox-git";
import {
	GithubApiError,
	type GithubRepoPermission,
} from "../modules/app-builder/infrastructure/github/github-app.client";
import type { ProjectGithubLinkRow } from "../modules/app-builder/infrastructure/persistence/project-github-links.repository";
import type { ResolvedProjectAccess } from "../modules/projects";
import {
	type GithubSyncDeps,
	isFinalGithubPushRefusal,
	runGithubSync,
} from "./github-sync.runtime";

const CS_HEAD = "c".repeat(40);
const GITHUB_HEAD = "a".repeat(40);

const LINK: ProjectGithubLinkRow = {
	createdAt: new Date("2026-11-01T10:00:00.000Z"),
	githubUserId: 583231,
	id: "link-1",
	installationId: 11,
	lastError: null,
	lastSyncedSha: null,
	mirroredSha: null,
	projectId: "0b9f1c52-6a43-4f7e-9d1a-2f4c8e7b5a10",
	remoteHeadSha: null,
	repoId: 22,
	repoName: "app",
	repoOwner: "octo",
	updatedAt: new Date("2026-11-01T10:00:00.000Z"),
	userId: "user-1",
};

// The linker owns the personal project of `LINK`.
const LINKER_ACCESS: ResolvedProjectAccess = {
	directRole: null,
	project: {
		engine: "v2_app",
		id: LINK.projectId,
		organizationId: null,
		userId: LINK.userId,
		workspaceAccess: "can_edit",
	},
	role: "owner",
	workspace: null,
	workspaceRoles: [],
};

// The git steps that a case can answer. "fetch-github" is the fetch from the GitHub URL.
const GIT_STEPS = [
	"fetch",
	"fetch-github",
	"rev-parse",
	"merge-base",
	"diff",
	"ls-tree",
	"push",
] as const;
type GitStep = (typeof GIT_STEPS)[number];

// GitHub is an ancestor of the code.storage head and no workflow changed: the run pushes.
const DEFAULT_GIT: Record<GitStep, Partial<SandboxExecResult>> = {
	diff: { exitCode: 0 },
	fetch: { exitCode: 0 },
	"fetch-github": { exitCode: 0 },
	"ls-tree": { exitCode: 0 },
	"merge-base": { exitCode: 0 },
	push: { exitCode: 0 },
	"rev-parse": { exitCode: 0, stdout: `${GITHUB_HEAD}\n` },
};

function makeWorld(
	over: {
		link?: Partial<ProjectGithubLinkRow>;
		/** What `ProjectAccessService.resolve` answers for the linker; null means no access. Default `LINKER_ACCESS`. */
		linkerAccess?: ResolvedProjectAccess | null;
		tokenError?: GithubApiError;
		/** The login that GitHub answers for the stored user id; null for a deleted account. Default "octo". */
		currentLogin?: string | null;
		permission?: GithubRepoPermission | null;
		permissionError?: GithubApiError;
		git?: Partial<Record<GitStep, Partial<SandboxExecResult>>>;
	} = {},
) {
	const currentLogin =
		over.currentLogin === undefined ? "octo" : over.currentLogin;
	const recorded: GithubSyncErrorCode[] = [];
	// The GitHub head that each `recordError` call wrote; null keeps the stored one.
	const recordedHeads: (string | null)[] = [];
	const synced: string[] = [];
	const gitSteps: string[] = [];
	const deps: GithubSyncDeps = {
		appCommits: { findBranch: async () => ({ headSha: CS_HEAD }) },
		exec: async (_command, args) => {
			const gitArgs = args.slice(SAFE_GIT_CONFIG_ARGS.length);
			const [command = ""] = gitArgs;
			const isGithubFetch =
				command === "fetch" &&
				gitArgs.some((arg) => arg.includes("github.com"));
			const name = isGithubFetch ? "fetch-github" : command;
			gitSteps.push(name);
			const step = GIT_STEPS.find((known) => known === name);
			const answer =
				step === undefined ? {} : { ...DEFAULT_GIT[step], ...over.git?.[step] };
			return { exitCode: 0, stderr: "", stdout: "", ...answer };
		},
		gitStore: {
			issueCredential: async () => ({
				expiresAt: new Date("2026-11-01T10:02:00.000Z"),
				password: "cs-jwt",
				remoteUrl: "https://git.code.storage/wandit/app.git",
				username: "t",
			}),
		},
		github: {
			collaboratorPermission: async (_token, _owner, _repo, login) => {
				if (over.permissionError !== undefined) {
					throw over.permissionError;
				}
				// GitHub answers 404 for a login that names nobody now.
				if (login !== currentLogin) {
					return null;
				}
				return over.permission === undefined ? "write" : over.permission;
			},
			installationToken: async () => {
				if (over.tokenError !== undefined) {
					throw over.tokenError;
				}
				return "ghs_installation";
			},
			userLogin: async () => currentLogin,
		},
		links: {
			findByProject: async () => ({ ...LINK, ...over.link }),
			markRemoteAhead: async () => {},
			markSynced: async (_linkId, sha) => {
				synced.push(sha);
			},
			recordError: async (_linkId, code, githubHead = null) => {
				recorded.push(code);
				recordedHeads.push(githubHead);
			},
		},
		logger: { warn: () => {} },
		projectAccess: {
			resolve: async () =>
				over.linkerAccess === undefined ? LINKER_ACCESS : over.linkerAccess,
		},
	};
	return { deps, gitSteps, recorded, recordedHeads, synced };
}

describe("isFinalGithubPushRefusal", () => {
	// A race throws so that the retry mirrors; a refusal stops the retries.
	it.each([
		[" ! [rejected]        abc -> main (non-fast-forward)", false],
		[" ! [rejected]        abc -> main (fetch first)", false],
		[" ! [rejected]        abc -> main (stale info)", false],
		[
			"remote: error: GH001: Large files detected.\n ! [remote rejected] abc -> main (pre-receive hook declined)",
			true,
		],
		[
			"fatal: unable to access 'https://github.com/octo/app.git/': Could not resolve host: github.com",
			false,
		],
		[
			"error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500",
			false,
		],
	])("%j is a final refusal: %s", (stderr, isFinal) => {
		expect(isFinalGithubPushRefusal(stderr)).toBe(isFinal);
	});
});

describe("runGithubSync", () => {
	// Security: a lost access stops the run before any git command reads or sends code.
	it.each([
		[
			"a linker who lost read access to the project",
			{ linkerAccess: null },
			"GITHUB_LINK_OWNER_LEFT",
		],
		[
			"an App that lost the repo",
			{ tokenError: new GithubApiError("GitHub answered 404", 404) },
			"GITHUB_ACCESS_LOST",
		],
		[
			"an App that the owner limited to other repos",
			{
				tokenError: new GithubApiError(
					"GitHub POST /app/installations/11/access_tokens answered 403: Resource not accessible by integration",
					403,
				),
			},
			"GITHUB_ACCESS_LOST",
		],
		[
			"a linker with read access only",
			{ permission: "read" },
			"GITHUB_LINKER_NO_ACCESS",
		],
		[
			"a linker who is not a collaborator",
			{ permission: null },
			"GITHUB_LINKER_NO_ACCESS",
		],
		[
			"a linker whose GitHub account is deleted",
			{ currentLogin: null },
			"GITHUB_LINKER_NO_ACCESS",
		],
	] satisfies [
		string,
		Parameters<typeof makeWorld>[0],
		GithubSyncErrorCode,
	][])("%s stops the sync", async (_label, over, code) => {
		const world = makeWorld(over);

		const result = await runGithubSync(world.deps, {
			isFinalAttempt: false,
			projectId: LINK.projectId,
		});

		expect(result).toEqual({ code, status: "stopped" });
		expect(world.recorded).toEqual([code]);
		expect(world.gitSteps).toEqual([]);
	});

	// Security: only a permission 403 skips the write check. A 5xx
	// or a rate limit must not open the push, and must not record a final stop.
	it.each([
		[
			"a write check that GitHub answers with 500",
			{ permissionError: new GithubApiError("GitHub answered 500", 500) },
		],
		[
			"a write check that hits the rate limit",
			{
				permissionError: new GithubApiError(
					"GitHub GET /repos/octo/app/collaborators/octo/permission answered 403: API rate limit exceeded for installation ID 11.",
					403,
				),
			},
		],
		[
			"a token mint that hits the secondary rate limit",
			{
				tokenError: new GithubApiError(
					"GitHub POST /app/installations/11/access_tokens answered 403: You have exceeded a secondary rate limit.",
					403,
				),
			},
		],
	] satisfies [
		string,
		Parameters<typeof makeWorld>[0],
	][])("%s throws before any git command", async (_label, over) => {
		const world = makeWorld(over);

		await expect(
			runGithubSync(world.deps, {
				isFinalAttempt: false,
				projectId: LINK.projectId,
			}),
		).rejects.toBeInstanceOf(GithubApiError);
		expect(world.gitSteps).toEqual([]);
		expect(world.recorded).toEqual([]);
	});

	// A 403 for a missing App permission is not a rate limit. The
	// sync must go on, else every link of an older App setup stops.
	it("a write check that GitHub refuses for a missing App permission still pushes", async () => {
		const world = makeWorld({
			permissionError: new GithubApiError(
				"GitHub GET /repos/octo/app/collaborators/octo/permission answered 403: Resource not accessible by integration",
				403,
			),
		});

		const result = await runGithubSync(world.deps, {
			isFinalAttempt: false,
			projectId: LINK.projectId,
		});

		expect(result).toEqual({ sha: CS_HEAD, status: "pushed" });
		expect(world.recorded).toEqual([]);
	});

	// A GitHub rename must not stop the sync. The write check must use the
	// current login of the stored id, not the repo owner "octo".
	it("a linker who renamed the GitHub account still pushes", async () => {
		const world = makeWorld({ currentLogin: "alice2" });

		const result = await runGithubSync(world.deps, {
			isFinalAttempt: false,
			projectId: LINK.projectId,
		});

		expect(result).toEqual({ sha: CS_HEAD, status: "pushed" });
		expect(world.recorded).toEqual([]);
	});

	// Security: a workflow that the builder wrote never reaches GitHub Actions.
	it.each([
		["a changed workflow file", { diff: { exitCode: 1 } }],
		[
			"a workflow file for an empty GitHub repo",
			{
				"fetch-github": {
					exitCode: 128,
					stderr: "fatal: couldn't find remote ref refs/heads/main",
				},
				"ls-tree": { stdout: ".github/workflows/ci.yml\n" },
			},
		],
	] satisfies [
		string,
		Partial<Record<GitStep, Partial<SandboxExecResult>>>,
	][])("%s blocks the push", async (_label, git) => {
		const world = makeWorld({ git });

		const result = await runGithubSync(world.deps, {
			isFinalAttempt: false,
			projectId: LINK.projectId,
		});

		expect(result).toEqual({
			code: "GITHUB_WORKFLOW_CHANGED",
			status: "stopped",
		});
		expect(world.gitSteps).not.toContain("push");
		expect(world.synced).toEqual([]);
	});

	// The row keeps the fetched GitHub head, so a mirrored head that GitHub dropped stops the banner.
	it("a push that GitHub refuses records the code and the fetched GitHub head, and does not throw", async () => {
		const world = makeWorld({
			git: {
				push: {
					exitCode: 1,
					stderr:
						" ! [remote rejected] abc -> main (protected branch hook declined)",
				},
			},
		});

		const result = await runGithubSync(world.deps, {
			isFinalAttempt: false,
			projectId: LINK.projectId,
		});

		expect(result).toEqual({ code: "GITHUB_PUSH_REJECTED", status: "stopped" });
		expect(world.recorded).toEqual(["GITHUB_PUSH_REJECTED"]);
		expect(world.recordedHeads).toEqual([GITHUB_HEAD]);
	});

	it("a push race on the last attempt records GITHUB_SYNC_FAILED and throws", async () => {
		const world = makeWorld({
			git: {
				push: {
					exitCode: 1,
					stderr: " ! [rejected]        abc -> main (fetch first)",
				},
			},
		});

		await expect(
			runGithubSync(world.deps, {
				isFinalAttempt: true,
				projectId: LINK.projectId,
			}),
		).rejects.toThrow("git push GitHub main failed");
		expect(world.recorded).toEqual(["GITHUB_SYNC_FAILED"]);
	});
});
