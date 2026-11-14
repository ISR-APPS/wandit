/**
 * `/api/v2/projects/:projectId/code`: the file tree and one file of the
 * project code, for the Code view (WANDIT-271). `CodeService` reads the
 * commit at the stored `main` head on code.storage, else the running sandbox.
 * Both routes sit behind the global AuthGuard and the `V2BuilderEnabledGuard`;
 * the global ProjectAccessGuard checks the project role, and `CodeService`
 * checks the scope. The tree route sets the ETag and Cache-Control headers.
 */
import {
	Controller,
	Get,
	Headers,
	Inject,
	Param,
	Query,
	Res,
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
import type { FastifyReply } from "fastify";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { CodeService } from "../../../application/services/code.service";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/**
 * The two Code view routes. Both are reads, so a project viewer may call
 * them, like `GET /api/v2/projects/:projectId`.
 */
@Controller("v2/projects/:projectId/code")
@UseGuards(V2BuilderEnabledGuard)
export class CodeController {
	constructor(
		@Inject(CodeService)
		private readonly codeService: CodeService,
	) {}

	/**
	 * A committed tree answers a strong ETag and `private, no-cache`. The
	 * browser then asks again and gets 304 with no body while the head stays.
	 * A sandbox tree, or a tree whose archive read failed, answers `no-store`.
	 */
	@RequireProjectRole("viewer")
	@Get()
	async snapshot(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Headers("if-none-match") ifNoneMatch: string | undefined,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Res({ passthrough: true }) reply: FastifyReply,
	): Promise<CodeSnapshotResponse | undefined> {
		const answer = await this.codeService.snapshot(
			projectScopeFromAccess(access, user.id),
			projectId,
			ifNoneMatch,
		);
		if (answer.etag === null) {
			reply.header("cache-control", "no-store");
		} else {
			reply.header("etag", answer.etag);
			reply.header("cache-control", "private, no-cache");
		}
		if (answer.kind === "notModified") {
			reply.status(304);
			return undefined;
		}
		return answer.snapshot;
	}

	@RequireProjectRole("viewer")
	@Get("file")
	file(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@Query(new ZodValidationPipe(codeFileQuerySchema)) query: CodeFileQuery,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
	): Promise<CodeFileResponse> {
		return this.codeService.file(
			projectScopeFromAccess(access, user.id),
			projectId,
			query.path,
		);
	}
}
