// HTTP endpoints for the Marketing tab: the polled card list, the HTML body
// of one finished asset (JSON envelope, rendered in a sandboxed iframe via
// srcdoc — never served as a navigable document), and a forced download.
// All behind the global AuthGuard; ownership is proven in repository joins.
import { Controller, Get, Inject, Param, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type MarketingAssetHtmlResponse,
	type MarketingAssetsResponse,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { MarketingAssetsService } from "../../../application/services/marketing-assets.service";

@Controller("v1")
export class MarketingAssetsController {
	constructor(
		@Inject(MarketingAssetsService)
		private readonly marketingAssetsService: MarketingAssetsService,
	) {}

	// Polled by the Marketing tab while any card is queued/generating.
	@Get("projects/:projectId/marketing-assets")
	list(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<MarketingAssetsResponse> {
		return this.marketingAssetsService.list(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("marketing-assets/:assetId/html")
	html(
		@Param("assetId", new ZodValidationPipe(uuidSchema))
		assetId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<MarketingAssetHtmlResponse> {
		return this.marketingAssetsService.html(
			projectScopeFrom(workspace, user.id),
			assetId,
		);
	}

	@Get("marketing-assets/:assetId/download")
	@SkipResponseEnvelope()
	async download(
		@Param("assetId", new ZodValidationPipe(uuidSchema))
		assetId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.marketingAssetsService.download(
			projectScopeFrom(workspace, user.id),
			assetId,
		);

		await reply
			.header("Content-Type", "text/html; charset=utf-8")
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(download.html);
	}
}
