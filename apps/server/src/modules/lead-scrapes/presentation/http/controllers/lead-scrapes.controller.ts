// HTTP endpoints for the chat's lead-scrape card: the polled status read and
// the workbook download, both behind the global AuthGuard; ownership is
// proven in the repository's project join.
import { Controller, Get, Inject, Param, Res } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { type LeadScrapeAttempt, uuidSchema } from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import { CurrentWorkspace } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { LeadScrapesService } from "../../../application/services/lead-scrapes.service";

const XLSX_CONTENT_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

@Controller("v1/lead-scrapes")
export class LeadScrapesController {
	constructor(
		@Inject(LeadScrapesService)
		private readonly leadScrapesService: LeadScrapesService,
	) {}

	// Polled by the chat card while an attempt is queued/running.
	@Get(":attemptId")
	attempt(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<LeadScrapeAttempt> {
		return this.leadScrapesService.attempt(
			projectScopeFrom(workspace, user.id),
			attemptId,
		);
	}

	// Raw attachment response on purpose (NOT the JSON envelope): the browser
	// navigates here and the Content-Disposition header names the file.
	@Get(":attemptId/download")
	@SkipResponseEnvelope()
	async download(
		@Param("attemptId", new ZodValidationPipe(uuidSchema))
		attemptId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.leadScrapesService.download(
			projectScopeFrom(workspace, user.id),
			attemptId,
		);

		await reply
			.header("Content-Type", XLSX_CONTENT_TYPE)
			// The filename is slugified ASCII (leadsWorkbookFilename), so plain
			// quoting is header-safe.
			.header(
				"Content-Disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("Cache-Control", "private, no-store")
			.send(Buffer.from(download.bytes));
	}
}
