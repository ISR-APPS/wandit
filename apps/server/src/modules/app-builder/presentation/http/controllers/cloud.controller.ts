/**
 * `/api/v2/projects/:projectId/cloud/*`: the routes of the Cloud tab
 * (WANDIT-187). The global AuthGuard requires a session, the workspace
 * guard reads `x-wandit-workspace` and checks `project:update`,
 * `V2BuilderEnabledGuard` gates the module, and `RedisRateLimitGuard`
 * reads the `@RateLimit` on the SQL route. This file parses and
 * delegates to `CloudService`; `RetryAfterInterceptor` adds the
 * `Retry-After` header to a 429 from the upstream bucket.
 */
import {
	Body,
	type CallHandler,
	Controller,
	Delete,
	type ExecutionContext,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Injectable,
	type NestInterceptor,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type CloudAuthUsersQuery,
	type CloudAuthUsersResponse,
	type CloudBackendResponse,
	type CloudBucketsResponse,
	type CloudDeleteObjectsBody,
	type CloudDeleteObjectsResponse,
	type CloudFunctionsResponse,
	type CloudJobsResponse,
	type CloudLogsQuery,
	type CloudLogsResponse,
	type CloudObjectsQuery,
	type CloudObjectsResponse,
	type CloudRowsQuery,
	type CloudRowsResponse,
	type CloudSignupsResponse,
	type CloudSqlBody,
	type CloudSqlResponse,
	type CloudTablesQuery,
	type CloudTablesResponse,
	type CloudUploadUrlBody,
	type CloudUploadUrlResponse,
	cloudAuthUsersQuerySchema,
	cloudBucketNameSchema,
	cloudDeleteObjectsBodySchema,
	cloudIdentifierSchema,
	cloudLogsQuerySchema,
	cloudObjectsQuerySchema,
	cloudRowsQuerySchema,
	cloudSqlBodySchema,
	cloudTablesQuerySchema,
	cloudUploadUrlBodySchema,
	uuidSchema,
} from "@wandit/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";

import { readRequestCountryCode } from "../../../../../infrastructure/http/request-country-code";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { projectScopeFrom } from "../../../../projects/domain/project-scope";
import type { WorkspaceContext } from "../../../../workspaces/domain/workspace-context";
import {
	CurrentWorkspace,
	RequireWorkspacePermission,
} from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import {
	CloudRateLimitedException,
	CloudService,
} from "../../../application/services/cloud.service";
import {
	RateLimit,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";

/**
 * Copies `retryAfterSeconds` of a `CloudRateLimitedException` into the
 * `Retry-After` header before the global filter sends the 429 envelope.
 */
@Injectable()
export class RetryAfterInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const reply = context.switchToHttp().getResponse<FastifyReply>();
		return next.handle().pipe(
			catchError((error: unknown) => {
				if (error instanceof CloudRateLimitedException) {
					// Set on the reply before the throw: ApiExceptionFilter sends
					// on the same object, so the header survives.
					reply.header("Retry-After", String(error.retryAfterSeconds));
				}
				return throwError(() => error);
			}),
		);
	}
}

const projectIdParam = Param("projectId", new ZodValidationPipe(uuidSchema));
const tableParam = Param("table", new ZodValidationPipe(cloudIdentifierSchema));
const bucketParam = Param(
	"bucket",
	new ZodValidationPipe(cloudBucketNameSchema),
);

/** The Cloud tab routes of the V2 app builder. */
@Controller("v2/projects/:projectId/cloud")
@UseGuards(V2BuilderEnabledGuard, RedisRateLimitGuard)
@UseInterceptors(RetryAfterInterceptor)
// Every panel shows user data of the app, so reads need `project:update`
// too. Owner, admin, and member all hold it; a non-member answers 404 in
// the service.
@RequireWorkspacePermission("project", "update")
export class CloudController {
	constructor(
		@Inject(CloudService)
		private readonly cloud: CloudService,
	) {}

	@Get("backend")
	getBackend(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudBackendResponse> {
		return this.cloud.getBackend(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Post("backend")
	ensureBackend(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
		@Req() request: FastifyRequest,
	): Promise<CloudBackendResponse> {
		return this.cloud.ensureBackend(
			projectScopeFrom(workspace, user.id),
			projectId,
			// Edge geo header, best-effort context only (not a security input).
			readRequestCountryCode(request.headers),
		);
	}

	@Post("backend/restore")
	@HttpCode(HttpStatus.OK)
	restoreBackend(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudBackendResponse> {
		return this.cloud.restoreBackend(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("tables")
	listTables(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(cloudTablesQuerySchema))
		query: CloudTablesQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudTablesResponse> {
		return this.cloud.listTables(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	@Get("tables/:table/rows")
	listRows(
		@projectIdParam projectId: string,
		@tableParam table: string,
		@Query(new ZodValidationPipe(cloudRowsQuerySchema))
		query: CloudRowsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudRowsResponse> {
		return this.cloud.listRows(
			projectScopeFrom(workspace, user.id),
			projectId,
			table,
			query,
		);
	}

	// 30 statements per user per minute (ESTIMATE): a console user types,
	// not scripts. The per-ref upstream bucket sits under it in the service.
	@RateLimit({ key: "cloud-sql", limit: 30, windowMs: 60_000 })
	@Post("sql")
	@HttpCode(HttpStatus.OK)
	runSql(
		@projectIdParam projectId: string,
		@Body(new ZodValidationPipe(cloudSqlBodySchema)) body: CloudSqlBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudSqlResponse> {
		return this.cloud.runSql(
			projectScopeFrom(workspace, user.id),
			projectId,
			body,
		);
	}

	@Get("auth/users")
	listAuthUsers(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(cloudAuthUsersQuerySchema))
		query: CloudAuthUsersQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudAuthUsersResponse> {
		return this.cloud.listAuthUsers(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	@Get("auth/signups")
	listSignups(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudSignupsResponse> {
		return this.cloud.listSignups(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("storage/buckets")
	listBuckets(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudBucketsResponse> {
		return this.cloud.listBuckets(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("storage/buckets/:bucket/objects")
	listObjects(
		@projectIdParam projectId: string,
		@bucketParam bucket: string,
		@Query(new ZodValidationPipe(cloudObjectsQuerySchema))
		query: CloudObjectsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudObjectsResponse> {
		return this.cloud.listObjects(
			projectScopeFrom(workspace, user.id),
			projectId,
			bucket,
			query,
		);
	}

	@Post("storage/buckets/:bucket/objects/upload-url")
	createUploadUrl(
		@projectIdParam projectId: string,
		@bucketParam bucket: string,
		@Body(new ZodValidationPipe(cloudUploadUrlBodySchema))
		body: CloudUploadUrlBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudUploadUrlResponse> {
		return this.cloud.createUploadUrl(
			projectScopeFrom(workspace, user.id),
			projectId,
			bucket,
			body,
		);
	}

	@Delete("storage/buckets/:bucket/objects")
	deleteObjects(
		@projectIdParam projectId: string,
		@bucketParam bucket: string,
		@Body(new ZodValidationPipe(cloudDeleteObjectsBodySchema))
		body: CloudDeleteObjectsBody,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudDeleteObjectsResponse> {
		return this.cloud.deleteObjects(
			projectScopeFrom(workspace, user.id),
			projectId,
			bucket,
			body,
		);
	}

	@Get("logs")
	queryLogs(
		@projectIdParam projectId: string,
		@Query(new ZodValidationPipe(cloudLogsQuerySchema))
		query: CloudLogsQuery,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudLogsResponse> {
		return this.cloud.queryLogs(
			projectScopeFrom(workspace, user.id),
			projectId,
			query,
		);
	}

	@Get("functions")
	listFunctions(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudFunctionsResponse> {
		return this.cloud.listFunctions(
			projectScopeFrom(workspace, user.id),
			projectId,
		);
	}

	@Get("jobs")
	listJobs(
		@projectIdParam projectId: string,
		@CurrentUser() user: AuthUser,
		@CurrentWorkspace() workspace: WorkspaceContext,
	): Promise<CloudJobsResponse> {
		return this.cloud.listJobs(projectScopeFrom(workspace, user.id), projectId);
	}
}
