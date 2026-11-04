/**
 * The GitHub routes of the V2 app builder: the user connection (`/api/v2/github/account`,
 * `/api/v2/github/authorize`) and the project link (`/api/v2/projects/:projectId/github`, `/pull`).
 * The global AuthGuard requires a session; `V2BuilderEnabledGuard` gates the routes and
 * `RedisRateLimitGuard` reads `@RateLimit`. The services check the project scope.
 * `GithubCallbackController` holds the public OAuth callback.
 */
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CreateGithubRepositoryBody,
	createGithubRepositoryBodySchema,
	type GithubAccountResponse,
	type GithubAuthorizeBody,
	type GithubAuthorizeResponse,
	type GithubPullBody,
	type GithubPullResponse,
	githubAuthorizeBodySchema,
	githubPullBodySchema,
	type ProjectGithubStatusResponse,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readClientIp } from "../../../../../infrastructure/http/client-ip";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { GithubAccountService } from "../../../application/services/github-account.service";
import { GithubProjectService } from "../../../application/services/github-project.service";
import { VersionsService } from "../../../application/services/versions.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/** The GitHub account and project link routes of the V2 app builder. */
@Controller("v2")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class GithubController {
	constructor(
		@Inject(GithubAccountService)
		private readonly accounts: Pick<
			GithubAccountService,
			"account" | "authorize" | "disconnect"
		>,
		@Inject(GithubProjectService)
		private readonly projects: Pick<
			GithubProjectService,
			"status" | "link" | "unlink"
		>,
		@Inject(VersionsService)
		private readonly versions: Pick<VersionsService, "pullFromGithub">,
	) {}

	@Get("github/account")
	account(@CurrentUser() user: AuthUser): Promise<GithubAccountResponse> {
		return this.accounts.account(user.id);
	}

	@Delete("github/account")
	@HttpCode(204)
	disconnect(@CurrentUser() user: AuthUser): Promise<void> {
		return this.accounts.disconnect(user.id);
	}

	@Post("github/authorize")
	authorize(
		@Body(new ZodValidationPipe(githubAuthorizeBodySchema))
		body: GithubAuthorizeBody,
		@CurrentUser() user: AuthUser,
	): Promise<GithubAuthorizeResponse> {
		return this.accounts.authorize(user.id, body);
	}

	// Each open tab polls it every 15 s and on window focus. The service lets
	// one GitHub read through per interval, so this bucket only caps a loop.
	@RateLimit({ key: "github-status", limit: 60, windowMs: 60_000 })
	@Get("projects/:projectId/github")
	status(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ProjectGithubStatusResponse> {
		return this.projects.status(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Each link creates a GitHub repo and starts a full-history push on the
	// worker: 5 per user per 10 minutes.
	@RequireWorkspacePermission("project", "update")
	@RateLimit({ key: "github-link", limit: 5, windowMs: 10 * 60_000 })
	@Post("projects/:projectId/github")
	link(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(createGithubRepositoryBodySchema))
		body: CreateGithubRepositoryBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<ProjectGithubStatusResponse> {
		return this.projects.link(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}

	@RequireWorkspacePermission("project", "update")
	@Delete("projects/:projectId/github")
	@HttpCode(204)
	unlink(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<void> {
		return this.projects.unlink(
			projectScopeFrom(workspace, user.id),
			projectId,
			readClientIp(request),
		);
	}

	// A pull writes a commit, so it needs the same permission as a turn.
	@RequireWorkspacePermission("project", "update")
	@Post("projects/:projectId/github/pull")
	pull(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(githubPullBodySchema))
		body: GithubPullBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<GithubPullResponse> {
		return this.versions.pullFromGithub(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
			readClientIp(request),
		);
	}
}
