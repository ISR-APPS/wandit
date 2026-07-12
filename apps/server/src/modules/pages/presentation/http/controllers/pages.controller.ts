// HTTP endpoints for the Page tab. Both are plain JSON reads behind the
// global AuthGuard; ownership is proven in the repository queries.
//
// Route prefix is "v1" (not "v1/pages") because the two routes live under
// different roots: /v1/projects/:id/page and /v1/pages/versions/:id/html.
import { Controller, Get, Inject, Param } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PageOverview,
	type PageVersionHtml,
	uuidSchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { PagesService } from "../../../application/services/pages.service";

@Controller("v1")
export class PagesController {
	constructor(
		@Inject(PagesService)
		private readonly pagesService: PagesService,
	) {}

	// Polled by the web while an attempt is queued/generating.
	@Get("projects/:projectId/page")
	overview(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
	): Promise<PageOverview> {
		return this.pagesService.overview(user.id, projectId);
	}

	// JSON envelope on purpose (NOT a raw text/html response): the web puts
	// the string into a sandboxed iframe via srcdoc, so serving a document
	// here would only invite it being opened as a page.
	@Get("pages/versions/:versionId/html")
	versionHtml(
		@Param("versionId", new ZodValidationPipe(uuidSchema))
		versionId: string,
		@CurrentUser() user: AuthUser,
	): Promise<PageVersionHtml> {
		return this.pagesService.versionHtml(user.id, versionId);
	}
}
