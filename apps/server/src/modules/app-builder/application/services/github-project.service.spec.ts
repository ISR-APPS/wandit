import {
	ConflictException,
	ForbiddenException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { GithubInstallation } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { projectScopeFrom } from "../../../projects";
import { GithubApiError } from "../../infrastructure/github/github-app.client";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import type { ProjectGithubLinkRow } from "../../infrastructure/persistence/project-github-links.repository";
import { GithubProjectService } from "./github-project.service";

// The caller in their own personal workspace.
const SCOPE = projectScopeFrom(undefined, "user-1");
// A TEST-NET-3 address (RFC 5737): it never names a real client.
const IP = "203.0.113.7";
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.1.0",
	userId: "user-1",
};

// GitHub user id of octocat, saved at the callback.
const OCTOCAT_ID = 583231;

// What `/user/installations` answers for the token of octocat. After a
// GitHub rename, another user can hold the old login of the caller, so
// installation 2 has the stored login text but another id.
const INSTALLATIONS: GithubInstallation[] = [
	{
		accountId: OCTOCAT_ID,
		accountLogin: "octocat2",
		accountType: "User",
		id: 1,
	},
	{ accountId: 9001, accountLogin: "octocat", accountType: "User", id: 2 },
	{ accountId: 7001, accountLogin: "acme", accountType: "Organization", id: 3 },
];

// A link of project p-1 that the worker never synced.
const LINK: ProjectGithubLinkRow = {
	createdAt: new Date("2026-11-01T10:00:00.000Z"),
	githubUserId: OCTOCAT_ID,
	id: "link-1",
	installationId: 1,
	lastError: null,
	lastSyncedSha: null,
	mirroredSha: null,
	projectId: "p-1",
	remoteHeadSha: null,
	repoId: 99,
	repoName: "my-app",
	repoOwner: "octocat",
	updatedAt: new Date("2026-11-01T10:00:00.000Z"),
	userId: "user-1",
};

// A GitHub `main` head that the project does not have.
const GITHUB_HEAD = "1111111111111111111111111111111111111111";

/** The service on fakes. `link` is what `findByProject` answers; null means no link. */
function fixture(link: ProjectGithubLinkRow | null = null) {
	const github = {
		branchHeadSha: vi.fn(async (): Promise<string | null> => GITHUB_HEAD),
		createRepository: vi.fn(async () => ({
			id: 99,
			name: "my-app",
			ownerLogin: "octocat",
		})),
		installationToken: vi.fn(async () => "ghs_installation"),
		isConfigured: () => true,
		isWebhookConfigured: () => true,
		listUserInstallations: vi.fn(async () => INSTALLATIONS),
	};
	const links = {
		claimGithubCheck: vi.fn(async () => true),
		deleteByProject: async () => true,
		findByProject: async () => link,
		findProjectIdsByRepoId: async () => [],
		insert: vi.fn(async () => "link-1"),
	};
	const service = new GithubProjectService(
		{
			findBranch: async () => ({ headSha: null }),
			findScopedProject: async () => PROJECT,
		},
		links,
		github,
		{
			userAccess: async () => ({
				accessToken: "ghu_octocat",
				githubLogin: "octocat",
				githubUserId: OCTOCAT_ID,
			}),
		},
		{ scheduleIfLinked: async () => undefined },
		{ record: async () => undefined },
	);
	return { github, links, service };
}

describe("GithubProjectService.link", () => {
	// Security: the id comes from the client, and the GitHub list
	// also holds personal installations of other users. `POST /user/repos`
	// would create the repo on the caller's account.
	it.each([
		{ installationId: 404, reason: "an id that GitHub does not list" },
		{ installationId: 2, reason: "the personal installation of another user" },
	])("answers 403 GITHUB_INSTALLATION_NOT_YOURS and creates no repo for $reason", async ({
		installationId,
	}) => {
		const { github, service } = fixture();

		const failure = await service
			.link(SCOPE, "p-1", { installationId, name: "my-app", private: true }, IP)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ForbiddenException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ForbiddenException).getResponse()).toMatchObject({
			code: "GITHUB_INSTALLATION_NOT_YOURS",
		});
		expect(github.createRepository).not.toHaveBeenCalled();
	});

	// The account route keeps a revoked user token, so the panel can still send
	// a link. GitHub then answers 401, and the route must not answer 500.
	it.each([
		{ call: "listUserInstallations" },
		{ call: "createRepository" },
	] as const)("answers 409 GITHUB_NOT_CONNECTED when $call gets a 401", async ({
		call,
	}) => {
		const { github, service } = fixture();
		github[call].mockRejectedValueOnce(
			new GithubApiError("GitHub answered 401", 401),
		);

		const failure = await service
			.link(
				SCOPE,
				"p-1",
				{ installationId: 1, name: "my-app", private: true },
				IP,
			)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ConflictException);
		// SAFETY: toBeInstanceOf above proves the error type; getResponse
		// carries the { code, message } body passed to the constructor.
		expect((failure as ConflictException).getResponse()).toMatchObject({
			code: "GITHUB_NOT_CONNECTED",
		});
	});

	// Without the App env, the link check after the create fails. A repo made
	// first would stay on GitHub with no link, and a retry gets GITHUB_REPO_EXISTS.
	it("answers 503 and creates no repo when the GitHub App is not configured", async () => {
		const { github, service } = fixture();
		github.isConfigured = () => false;

		const failure = await service
			.link(
				SCOPE,
				"p-1",
				{ installationId: 1, name: "my-app", private: true },
				IP,
			)
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(ServiceUnavailableException);
		expect(github.createRepository).not.toHaveBeenCalled();
	});
});

describe("GithubProjectService.status", () => {
	// Each open tab polls every 15 s. Only the request that wins the claim may
	// call GitHub, else the polls use up the GitHub rate limit.
	it.each([
		{ claimed: true, githubReads: 1 },
		{ claimed: false, githubReads: 0 },
	])("reads the GitHub head $githubReads time(s) when the claim answers $claimed", async ({
		claimed,
		githubReads,
	}) => {
		const { github, links, service } = fixture(LINK);
		links.claimGithubCheck.mockResolvedValueOnce(claimed);

		await service.status(SCOPE, "p-1");

		expect(github.branchHeadSha).toHaveBeenCalledTimes(githubReads);
	});
});
