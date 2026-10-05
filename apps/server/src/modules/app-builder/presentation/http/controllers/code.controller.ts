/**
 * `/api/v2/projects/:projectId/code`: the file tree and one file of the
 * running project sandbox, for the Code view (WANDIT-271). Both routes sit
 * behind the global AuthGuard and the `V2BuilderEnabledGuard`; the scope
 * check runs in `CodeService` through `projectScopeFrom`.
 */
import {
	Controller,
	Get,
	Inject,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CodeFileQuery,
	type CodeFileResponse,
	type CodeSnapshotResponse,
	codeFileQuerySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { CodeService } from "../../../application/services/code.service";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/**
 * The two Code view routes. Both are reads, so any workspace member may
 * call them, like `GET /api/v2/projects/:projectId`.
 */
@Controller("v2/projects/:projectId/code")
@UseGuards(V2BuilderEnabledGuard)
export class CodeController {
	constructor(
		@Inject(CodeService)
		private readonly codeService: CodeService,
	) {}

	@Get()
	snapshot(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CodeSnapshotResponse> {
		return this.codeService.snapshot(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("file")
	file(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(codeFileQuerySchema)) query: CodeFileQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CodeFileResponse> {
		return this.codeService.file(
			projectScopeFrom(workspace, user.id),
			projectId,
			query.path,
		);
	}
}
