// HTTP endpoints for the Page tab: two plain JSON reads plus the edit-ops
// write, all behind the global AuthGuard; ownership is proven in the
// repository queries.
//
// Route prefix is "v1" (not "v1/pages") because the routes live under
// different roots: /v1/projects/:id/page and /v1/pages/versions/:id/html.
import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ApplyPageOpsBody,
	type ApplyPageOpsResponse,
	applyPageOpsBodySchema,
	type ListPageVersionsResponse,
	type PageOverview,
	type PageVersionHtml,
	type RestorePageVersionBody,
	type RestorePageVersionResponse,
	restorePageVersionBodySchema,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, EarlyAccessGuard } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { PageEditsService } from "../../../application/services/page-edits.service";
import { PagesService } from "../../../application/services/pages.service";

@Controller("v1")
export class PagesController {
	constructor(
		@Inject(PagesService)
		private readonly pagesService: PagesService,
		@Inject(PageEditsService)
		private readonly pageEditsService: PageEditsService,
	) {}

	// One inline-editor/theme-panel Save = one op batch = one NEW immutable
	// version (spec §7/§14). The body schema only accepts client op kinds —
	// a replace-section op 400s at validation (the browser never sends HTML).
	@UseGuards(EarlyAccessGuard)
	@RequireWorkspacePermission("project", "update")
	@Post("projects/:projectId/page/ops")
	applyOps(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Body(new ZodValidationPipe(applyPageOpsBodySchema))
		body: ApplyPageOpsBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ApplyPageOpsResponse> {
		return this.pageEditsService.applyClientOps(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	// Polled by the web while an attempt is queued/generating.
	@Get("projects/:projectId/page")
	overview(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<PageOverview> {
		return this.pagesService.overview(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Version history, newest first, with the live version marked.
	@Get("projects/:projectId/page/versions")
	versions(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<ListPageVersionsResponse> {
		return this.pagesService.listVersions(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	// Copy a historical version forward as a new immutable active version.
	// The expected pointer gives restores the same compare-and-swap discipline
	// as inline edit batches.
	@UseGuards(EarlyAccessGuard)
	@RequireWorkspacePermission("project", "update")
	@Post("projects/:projectId/page/versions/:versionId/restore")
	restoreVersion(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Param("versionId", new ZodValidationPipe(uuidSchema))
		versionId: string,
		@Body(new ZodValidationPipe(restorePageVersionBodySchema))
		body: RestorePageVersionBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<RestorePageVersionResponse> {
		return this.pageEditsService.restoreVersion(
			projectScopeFrom(workspace, user.id),
			projectId,
			versionId,
			body,
		);
	}

	// JSON envelope on purpose (NOT a raw text/html response): the web puts
	// the string into a sandboxed iframe via srcdoc, so serving a document
	// here would only invite it being opened as a page.
	@Get("pages/versions/:versionId/html")
	versionHtml(
		@Param("versionId", new ZodValidationPipe(uuidSchema))
		versionId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<PageVersionHtml> {
		return this.pagesService.versionHtml(
			projectScopeFrom(workspace, user.id),
			versionId,
		);
	}
}
