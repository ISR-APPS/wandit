/**
 * Mints the signed preview token behind
 * `GET /api/v2/projects/:projectId/preview-token` (WANDIT-170), for the
 * iframe or, with `client=phone`, for the phone link (WANDIT-193).
 * `PreviewTokenController` calls `mint`; the preview-proxy Worker in
 * `apps/preview-proxy` verifies the token. Reads `projects` and
 * `sandbox_sessions` through repositories and signs the claims with the
 * shared `signPreviewToken` helper.
 */
import { randomUUID } from "node:crypto";

import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	PREVIEW_TOKEN_QUERY,
	PREVIEW_TOKEN_TTL_SECONDS,
	type PreviewTokenQuery,
	type PreviewTokenResponse,
	previewHostFor,
	signPreviewToken,
} from "@wandit/contracts";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	requireV2Env,
	V2_ENV,
	type V2EnvSource,
} from "../../infrastructure/env/v2-env";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import {
	SandboxSessionsRepository,
	type SandboxSessionsStore,
} from "../../infrastructure/persistence/sandbox-sessions.repository";

/**
 * Application service behind the preview-token route. The token lives 15
 * minutes; the Worker trusts the HMAC signature and forwards to the `up`
 * origin.
 */
@Injectable()
export class PreviewTokenService {
	private readonly logger = new Logger(PreviewTokenService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes a plain fake. Nest still injects by the class token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(SandboxSessionsRepository)
		private readonly sessions: Pick<
			SandboxSessionsStore,
			"findLiveByProjectId" | "touchActivity"
		>,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	/**
	 * Signs the preview token of the project's running sandbox and answers
	 * the `?wt=` URL on the isolated `r-<rid12>--p-<projectId>` host.
	 * A phone query adds the Expo Go username claim. Throws 404 for a
	 * missing, out-of-scope, or V1 project and 409 `SANDBOX_NOT_RUNNING`
	 * when no running row has a preview host.
	 */
	async mint(
		scope: ProjectScope,
		projectId: string,
		query: PreviewTokenQuery = {},
	): Promise<PreviewTokenResponse> {
		// `z.uuid()` accepts upper-case hex and Postgres matches it, but the
		// Worker lower-cases the host, so the claims must be lower-case too.
		const pid = projectId.toLowerCase();
		// Same scope and engine gate as the versions routes: a V1 project or
		// another workspace's project answers 404, not 403.
		const project = await this.appCommits.findScopedProject(scope, pid);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}

		const row = await this.sessions.findLiveByProjectId(pid);
		// A `creating` or `stopped` row has no reachable dev port; only a
		// running sandbox with its vendor host can serve the preview.
		if (row === null || row.status !== "running" || row.previewHost === null) {
			throw new ConflictException({
				code: "SANDBOX_NOT_RUNNING",
				message: "The preview is not running",
			});
		}

		// `exp` is unix seconds; the Worker compares it to its own clock.
		const exp = Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
		const token = await signPreviewToken(
			{
				exp,
				// The schema accepts it only with client=phone; the Worker copies
				// it into the phone link and the Expo manifest.
				expoUsername: query.expoUsername,
				jti: randomUUID(),
				pid,
				rid: row.id,
				uid: scope.userId,
				up: `https://${row.previewHost}`,
			},
			requireV2Env("PREVIEW_TOKEN_SIGNING_KEY", this.v2Env),
		);

		// The token holds base64url characters and "." only, so the query
		// value needs no percent-encoding.
		const previewUrl = `https://${previewHostFor(pid, row.id, requireV2Env("PREVIEW_DOMAIN", this.v2Env))}/?${PREVIEW_TOKEN_QUERY}=${token}`;

		// A user who opens the preview counts as activity; the stamp keeps
		// the idle sweep away while the preview is open.
		await this.sessions.touchActivity(pid);
		// A phone link opens the source bundles to any phone that holds it,
		// so each mint leaves an audit line (WANDIT-193).
		if (query.client === "phone") {
			this.logger.log("preview.phone-token.minted", {
				projectId: pid,
				userId: scope.userId,
			});
		}

		return {
			expiresAt: new Date(exp * 1000).toISOString(),
			previewUrl,
			token,
		};
	}
}
