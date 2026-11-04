/**
 * The GitHub link of one V2 project: the status with the GitHub head check, the link
 * (create an empty repo and link it), the unlink, and the `push` webhook. `GithubController`
 * and `GithubWebhookController` call it; the Update (pull) lives in `VersionsService.pullFromGithub`.
 * It calls `GithubAppClient`,
 * `ProjectGithubLinksRepository`, `GithubAccountService.userAccess`, the GitHub sync scheduler,
 * and `AuditEventsService`.
 */
import {
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	CreateGithubRepositoryBody,
	GithubInstallation,
	ProjectGithubLink,
	ProjectGithubStatusResponse,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	githubStateScheduleKey,
	isGithubUpdateAvailable,
} from "../../domain/github-sync";
import {
	GITHUB_SYNC_SCHEDULER,
	type GithubSyncScheduler,
} from "../../domain/ports/github-sync-scheduler";
import {
	GITHUB_READ_PERMISSIONS,
	GithubApiError,
	GithubAppClient,
	GithubRepoExistsError,
	type GithubRepository,
} from "../../infrastructure/github/github-app.client";
import {
	AppCommitsRepository,
	type ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import {
	type ProjectGithubLinkRow,
	ProjectGithubLinksRepository,
} from "../../infrastructure/persistence/project-github-links.repository";
import { AuditEventsService } from "./audit-events.service";
import { GithubAccountService } from "./github-account.service";

// Without the webhook, the status read of the GitHub head is the only way to
// see a GitHub push, so it runs once a minute.
const GITHUB_CHECK_INTERVAL_MS = 60_000;
// With the webhook, GitHub reports each push. The status read then only finds
// a lost delivery: GitHub does not send a failed delivery again.
const GITHUB_CHECK_INTERVAL_WITH_WEBHOOK_MS = 10 * 60_000;

/** Status, link, unlink, and push webhook of the GitHub repo of a project. */
@Injectable()
export class GithubProjectService {
	private readonly logger = new Logger(GithubProjectService.name);

	constructor(
		// The Pick types keep each seam narrow; a spec passes plain fakes.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject" | "findBranch"
		>,
		@Inject(ProjectGithubLinksRepository)
		private readonly links: Pick<
			ProjectGithubLinksRepository,
			| "findByProject"
			| "findProjectIdsByRepoId"
			| "claimGithubCheck"
			| "insert"
			| "deleteByProject"
		>,
		@Inject(GithubAppClient)
		private readonly github: Pick<
			GithubAppClient,
			| "isConfigured"
			| "isWebhookConfigured"
			| "installationToken"
			| "branchHeadSha"
			| "listUserInstallations"
			| "createRepository"
		>,
		@Inject(GithubAccountService)
		private readonly accounts: Pick<GithubAccountService, "userAccess">,
		@Inject(GITHUB_SYNC_SCHEDULER)
		private readonly githubSync: GithubSyncScheduler,
		@Inject(AuditEventsService)
		private readonly audit: Pick<AuditEventsService, "record">,
	) {}

	/**
	 * The link and sync state for the panel and the update banner. With a link, it reads the
	 * GitHub `main` head at most once per interval and schedules a sync when the heads differ.
	 * A failed GitHub read only logs: the next interval reads again, and the row still answers.
	 */
	async status(
		scope: ProjectScope,
		projectId: string,
	): Promise<ProjectGithubStatusResponse> {
		await this.requireV2Project(scope, projectId);
		const [link, branch] = await Promise.all([
			this.links.findByProject(projectId),
			this.appCommits.findBranch(projectId, "main"),
		]);
		const headSha = branch?.headSha ?? null;
		const appConfigured = this.github.isConfigured();
		// Security: after the linker leaves the org, the project stops reading
		// their repo. The worker records GITHUB_LINK_OWNER_LEFT.
		if (link !== null && appConfigured && link.linkerIsMember) {
			// The web polls from each open tab. The claim lets one GitHub read through per interval.
			const intervalMs = this.github.isWebhookConfigured()
				? GITHUB_CHECK_INTERVAL_WITH_WEBHOOK_MS
				: GITHUB_CHECK_INTERVAL_MS;
			const checkedBefore = new Date(Date.now() - intervalMs);
			if (await this.links.claimGithubCheck(link.id, checkedBefore)) {
				await this.scheduleWhenHeadsDiffer(link, headSha);
			}
		}
		return {
			appConfigured,
			headSha,
			link: link === null ? null : toApiLink(link),
		};
	}

	/**
	 * Creates an empty GitHub repo with the user token and links it; the first sync run pushes
	 * the whole history. 409 GITHUB_ALREADY_LINKED, GITHUB_NOT_CONNECTED (also on a revoked token),
	 * GITHUB_REPO_EXISTS, GITHUB_REPO_NOT_IN_INSTALLATION; 403 GITHUB_INSTALLATION_NOT_YOURS,
	 * GITHUB_REPO_CREATE_FORBIDDEN; 503 V2_ENV_MISSING. `ip` is the client IP for the audit row.
	 */
	async link(
		scope: ProjectScope,
		projectId: string,
		body: CreateGithubRepositoryBody,
		ip: string,
	): Promise<ProjectGithubStatusResponse> {
		const project = await this.requireV2Project(scope, projectId);
		// Check before the create: without the App env, the link check below
		// fails, and the new repo stays on GitHub with no link.
		if (!this.github.isConfigured()) {
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "The GitHub App is not configured",
			});
		}
		// Check before the create: a second repo would stay on GitHub with no link.
		if ((await this.links.findByProject(projectId)) !== null) {
			throw alreadyLinked();
		}
		const access = await this.accounts.userAccess(scope.userId);
		if (access === null) {
			throw notConnected();
		}
		// Security: the id comes from the client. Only an installation that GitHub
		// lists for this user token counts.
		const installations = await this.github
			.listUserInstallations(access.accessToken)
			.catch((error: unknown) => {
				throw isRevokedUserToken(error) ? notConnected() : error;
			});
		const installation = installations.find(
			(item) => item.id === body.installationId,
		);
		// Security: the list also holds personal installations of other
		// users. `POST /user/repos` would create the repo on the caller's account.
		// The id compare survives a GitHub rename; the login text does not.
		if (
			installation === undefined ||
			(installation.accountType === "User" &&
				installation.accountId !== access.githubUserId)
		) {
			throw new ForbiddenException({
				code: "GITHUB_INSTALLATION_NOT_YOURS",
				message: "Pick one of your GitHub accounts or organizations",
			});
		}
		const repo = await this.createRepository(
			access.accessToken,
			installation,
			body,
		);
		// The App must reach the new repo, else every sync fails.
		// A 404 or a 422 means that the installation does not hold the repo.
		try {
			await this.github.installationToken(
				installation.id,
				repo.id,
				GITHUB_READ_PERMISSIONS,
			);
		} catch (error) {
			if (
				error instanceof GithubApiError &&
				(error.status === 404 || error.status === 422)
			) {
				throw new ConflictException({
					code: "GITHUB_REPO_NOT_IN_INSTALLATION",
					message: `The Wandit GitHub App cannot reach ${repo.ownerLogin}/${repo.name}. Give the App access to all repositories of ${installation.accountLogin} in GitHub, then try again with a new name.`,
				});
			}
			throw error;
		}
		const linkId = await this.links.insert({
			githubUserId: access.githubUserId,
			installationId: installation.id,
			organizationId: project.organizationId,
			projectId,
			repoId: repo.id,
			repoName: repo.name,
			repoOwner: repo.ownerLogin,
			userId: scope.userId,
		});
		// Another link request won the race after the check above. The new repo
		// stays on GitHub with no link.
		if (linkId === null) {
			throw alreadyLinked();
		}
		await this.audit.record({
			action: "github.link",
			actorUserId: scope.userId,
			ip,
			metadata: {
				repoId: repo.id,
				repoName: repo.name,
				repoOwner: repo.ownerLogin,
			},
			organizationId: project.organizationId,
			projectId,
			targetId: linkId,
			targetType: "project_github_link",
		});
		await this.githubSync.scheduleIfLinked(projectId, `link:${linkId}`);
		const branch = await this.appCommits.findBranch(projectId, "main");
		return {
			appConfigured: true,
			headSha: branch?.headSha ?? null,
			link: toApiLink({
				lastError: null,
				lastSyncedSha: null,
				mirroredSha: null,
				remoteHeadSha: null,
				repoName: repo.name,
				repoOwner: repo.ownerLogin,
			}),
		};
	}

	/**
	 * Removes the link; the GitHub repo stays. 404 GITHUB_NOT_LINKED without a link.
	 * `ip` is the client IP for the `github.unlink` audit row.
	 */
	async unlink(
		scope: ProjectScope,
		projectId: string,
		ip: string,
	): Promise<void> {
		const project = await this.requireV2Project(scope, projectId);
		const link = await this.links.findByProject(projectId);
		if (link === null || !(await this.links.deleteByProject(projectId))) {
			throw new NotFoundException({
				code: "GITHUB_NOT_LINKED",
				message: "This project has no GitHub repository",
			});
		}
		await this.audit.record({
			action: "github.unlink",
			actorUserId: scope.userId,
			ip,
			metadata: { repoName: link.repoName, repoOwner: link.repoOwner },
			organizationId: project.organizationId,
			projectId,
			targetId: link.id,
			targetType: "project_github_link",
		});
	}

	/**
	 * A GitHub `push` to `main` of repo `repoId`. `GithubWebhookController` calls it after the
	 * signature check. It reads the GitHub head itself and never trusts a sha of the delivery.
	 * A repo with no link does nothing.
	 */
	async handlePush(repoId: number): Promise<void> {
		const projectIds = await this.links.findProjectIdsByRepoId(repoId);
		for (const projectId of projectIds) {
			const [link, branch] = await Promise.all([
				this.links.findByProject(projectId),
				this.appCommits.findBranch(projectId, "main"),
			]);
			// Security: the same rule as `status`. After the linker leaves the org,
			// the project stops reading their repo.
			if (link?.linkerIsMember) {
				await this.scheduleWhenHeadsDiffer(link, branch?.headSha ?? null);
			}
		}
	}

	// Reads GitHub `main` and queues a sync run when it differs from our head or
	// from the stored GitHub head. A read that still shows the old head (GitHub
	// replica lag after a push) queues nothing; the next status interval finds it.
	private async scheduleWhenHeadsDiffer(
		link: ProjectGithubLinkRow,
		headSha: string | null,
	): Promise<void> {
		try {
			const token = await this.github.installationToken(
				link.installationId,
				link.repoId,
				GITHUB_READ_PERMISSIONS,
			);
			const githubHead = await this.github.branchHeadSha(
				token,
				link.repoOwner,
				link.repoName,
				"main",
			);
			const reasonKey = githubStateScheduleKey(
				headSha,
				githubHead,
				link.remoteHeadSha,
			);
			if (reasonKey !== null) {
				await this.githubSync.scheduleIfLinked(link.projectId, reasonKey);
			}
		} catch (error) {
			this.logger.warn(
				`GitHub head check failed for project ${link.projectId}: ${getErrorMessage(error)}`,
			);
		}
	}

	// The GitHub refusals of a repo create that the user can fix, as API errors.
	private async createRepository(
		userToken: string,
		installation: GithubInstallation,
		body: CreateGithubRepositoryBody,
	): Promise<GithubRepository> {
		try {
			return await this.github.createRepository(userToken, {
				name: body.name,
				ownerLogin: installation.accountLogin,
				ownerType: installation.accountType,
				private: body.private,
			});
		} catch (error) {
			if (error instanceof GithubRepoExistsError) {
				throw new ConflictException({
					code: "GITHUB_REPO_EXISTS",
					message: `${installation.accountLogin}/${body.name} already exists on GitHub`,
				});
			}
			if (isRevokedUserToken(error)) {
				throw notConnected();
			}
			// 403 or 404: the user may not create repositories in this org.
			if (
				error instanceof GithubApiError &&
				(error.status === 403 || error.status === 404)
			) {
				throw new ForbiddenException({
					code: "GITHUB_REPO_CREATE_FORBIDDEN",
					message: `GitHub does not let you create a repository in ${installation.accountLogin}`,
				});
			}
			throw error;
		}
	}

	// The project must exist inside the caller's scope and be a V2 app; a
	// V1 project or another workspace's project answers 404, not 403.
	private async requireV2Project(
		scope: ProjectScope,
		projectId: string,
	): Promise<ScopedAppProject> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}
		return project;
	}
}

function alreadyLinked(): ConflictException {
	return new ConflictException({
		code: "GITHUB_ALREADY_LINKED",
		message: "This project already has a GitHub repository",
	});
}

function notConnected(): ConflictException {
	return new ConflictException({
		code: "GITHUB_NOT_CONNECTED",
		message: "Connect GitHub first",
	});
}

// GitHub answers 401 to a user token after the user revokes the App. The
// account route still keeps that token, so the panel can still send a link.
function isRevokedUserToken(error: unknown): boolean {
	return error instanceof GithubApiError && error.status === 401;
}

// The link as the contract sees it. The row stores no URL; GitHub repo URLs
// follow the owner and the name.
function toApiLink(
	link: Pick<
		ProjectGithubLinkRow,
		| "lastError"
		| "lastSyncedSha"
		| "mirroredSha"
		| "remoteHeadSha"
		| "repoName"
		| "repoOwner"
	>,
): ProjectGithubLink {
	return {
		htmlUrl: `https://github.com/${link.repoOwner}/${link.repoName}`,
		lastError: link.lastError,
		lastSyncedSha: link.lastSyncedSha,
		remoteHeadSha: link.remoteHeadSha,
		repoName: link.repoName,
		repoOwner: link.repoOwner,
		updateAvailable: isGithubUpdateAvailable(link),
	};
}
