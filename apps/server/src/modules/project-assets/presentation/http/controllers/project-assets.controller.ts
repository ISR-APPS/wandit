import { Controller, Get, Inject, Param, Query, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ProjectAssetsResponse,
	uuidSchema,
	type WorkspaceAssetsResponse,
} from "@wandit/contracts";
import type { FastifyReply } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { ProjectAssetsService } from "../../../application/services/project-assets.service";

// R2 object keys are path-ish strings; the service re-validates the prefix
// against the owned project before anything is streamed.
const downloadKeySchema = z.string().min(1).max(1_024);

@Controller("v1")
export class ProjectAssetsController {
	constructor(
		@Inject(ProjectAssetsService)
		private readonly projectAssetsService: ProjectAssetsService,
	) {}

	// Dashboard Assets page: every asset across every project the active
	// workspace can see. Scoping is entirely projectScopePredicate inside the
	// service's repositories — no project id in the path.
	@Get("assets")
	listForWorkspace(
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<WorkspaceAssetsResponse> {
		return this.projectAssetsService.listWorkspaceAssets(
			projectScopeFrom(workspace, user.id),
		);
	}

	@Get("projects/:projectId/assets")
	async list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ProjectAssetsResponse> {
		return {
			assets: await this.projectAssetsService.listAssets(
				projectScopeFrom(workspace, user.id),
				projectId,
			),
		};
	}

	@Get("projects/:projectId/assets/download")
	@SkipResponseEnvelope()
	async download(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query("key", new ZodValidationPipe(downloadKeySchema))
		key: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.projectAssetsService.download(
			projectScopeFrom(workspace, user.id),
			projectId,
			key,
		);

		await reply
			.header("Content-Type", download.mediaType)
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(Buffer.from(download.bytes));
	}
}
