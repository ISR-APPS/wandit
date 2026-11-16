/**
 * HTTP routes for V2 app projects: create, get, the conversations of a
 * project, and the cost of one chat.
 * `V2BuilderEnabledGuard` gates the whole controller, and
 * `RedisRateLimitGuard` reads the `@RateLimit` on create. Create reads the
 * workspace header; the `:projectId` routes use the global ProjectAccessGuard. Platform,
 * attachment, credits, and engine checks live in `AppProjectsService`; this
 * file parses and delegates.
 */
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AppProject,
	type ChatCostResponse,
	type CreateAppProjectRequest,
	type CreateAppProjectResponse,
	type CreateProjectChatResponse,
	createAppProjectRequestSchema,
	type ProjectChatListResponse,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { readRequestCountryCode } from "../../../../../infrastructure/http/request-country-code";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFrom,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { AppProjectsService } from "../../../application/services/app-projects.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

// 10 creates per user per day (WANDIT-181). Each create can provision a
// backend and starts a first turn, so the cap stops a script that farms them.
const PROJECT_CREATE_LIMIT = 10;
// Three times the user cap: three people behind one office IP still fit,
// but the cap stops one person who uses many accounts.
const PROJECT_CREATE_IP_LIMIT = 30;
const PROJECT_CREATE_WINDOW_MS = 24 * 60 * 60_000;

@Controller("v2/projects")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
export class AppProjectsController {
	constructor(
		// The Pick type, not the class: a spec passes the fake without a cast.
		@Inject(AppProjectsService)
		private readonly appProjects: Pick<
			AppProjectsService,
			"chatCost" | "create" | "createChat" | "get" | "listChats"
		>,
	) {}

	@RequireWorkspacePermission("project", "create")
	@RateLimit({
		ipLimit: PROJECT_CREATE_IP_LIMIT,
		key: "project-create",
		limit: PROJECT_CREATE_LIMIT,
		windowMs: PROJECT_CREATE_WINDOW_MS,
	})
	@Post()
	create(
		@Body(new ZodValidationPipe(createAppProjectRequestSchema))
		body: CreateAppProjectRequest,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<CreateAppProjectResponse> {
		return this.appProjects.create(projectScopeFrom(workspace, user.id), body, {
			// Edge geo header, best-effort context only (not a security input).
			countryCode: readRequestCountryCode(request.headers),
		});
	}

	@RequireProjectRole("viewer")
	@Get(":projectId")
	get(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<AppProject> {
		return this.appProjects.get(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// Every member of the project reads all its conversations.
	@RequireProjectRole("viewer")
	@Get(":projectId/chats")
	listChats(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ProjectChatListResponse> {
		return this.appProjects.listChats(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// A new conversation is a write, like a turn create: it needs the editor role.
	// The route takes no body.
	@RequireProjectRole("editor")
	@Post(":projectId/chats")
	createChat(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<CreateProjectChatResponse> {
		return this.appProjects.createChat(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
	}

	// A read like the turn estimate. The service checks the chat: a foreign
	// chat id answers 404.
	@RequireProjectRole("viewer")
	@Get(":projectId/chats/:chatId/cost")
	chatCost(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("chatId", new ZodValidationPipe(uuidSchema))
		chatId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<ChatCostResponse> {
		return this.appProjects.chatCost(
			projectScopeFromAccess(access, user.id),
			projectId,
			chatId,
		);
	}
}
