/**
 * `/api/v2/projects/:projectId/code`: the file tree and one file of the
 * project code, for the Code view (WANDIT-271), and the tar.gz Download.
 * `CodeService` reads the commit at the stored `main` head on code.storage,
 * else the running sandbox. The routes sit behind the global AuthGuard and
 * the `V2BuilderEnabledGuard`; the global ProjectAccessGuard checks the
 * project role, and `CodeService` checks the scope. The tree route sets the
 * ETag and Cache-Control headers. `RedisRateLimitGuard` reads `@RateLimit`.
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

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import {
	CurrentProjectAccess,
	projectScopeFromAccess,
	RequireProjectRole,
	type ResolvedProjectAccess,
} from "../../../../projects";
import { CodeService } from "../../../application/services/code.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/**
 * The Code view routes and the Download. All are reads, so a project viewer
 * may call them, like `GET /api/v2/projects/:projectId`.
 */
@Controller("v2/projects/:projectId/code")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
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

	// Raw attachment, not the JSON envelope: the browser saves the file under the
	// Content-Disposition name. Each download holds up to 50 MB in the API
	// memory, so the bucket caps the downloads of one user.
	@RequireProjectRole("viewer")
	@RateLimit({ key: "code-archive", limit: 10, windowMs: 60_000 })
	@Get("archive")
	@SkipResponseEnvelope()
	async archive(
		@Param("projectId", new ZodValidationPipe(uuidSchema))
		projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentProjectAccess() access: ResolvedProjectAccess,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const download = await this.codeService.archive(
			projectScopeFromAccess(access, user.id),
			projectId,
		);
		await reply
			.header("content-type", "application/gzip")
			// The file name is a slug of a-z, 0-9, and "-", so plain quotes are header-safe.
			.header(
				"content-disposition",
				`attachment; filename="${download.fileName}"`,
			)
			.header("cache-control", "private, no-store")
			// A view on the same memory: a copy would hold a second 50 MB.
			.send(
				Buffer.from(
					download.bytes.buffer,
					download.bytes.byteOffset,
					download.bytes.byteLength,
				),
			);
	}
}
