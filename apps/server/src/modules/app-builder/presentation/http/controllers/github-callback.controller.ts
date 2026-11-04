/**
 * `GET /api/v2/github/callback`: GitHub sends the browser here after a connect or an App install.
 * It is `@Public()`, with no V2 flag guard and no user rate limit. The AuthGuard sets
 * no user on a public route, so both would refuse every callback. It reads the Better Auth session
 * itself and always answers a 302 to the web app. `GithubAccountService.handleCallback` does the checks.
 */
import {
	Controller,
	Get,
	Inject,
	Logger,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import {
	GITHUB_ERROR_PARAM,
	type GithubCallbackQuery,
	githubCallbackQuerySchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import type { FastifyReply, FastifyRequest } from "fastify";

import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { AUTH_INSTANCE, Public } from "../../../../auth";
import {
	GithubAccountService,
	githubCallbackFallbackUrl,
} from "../../../application/services/github-account.service";

/** The public OAuth callback of the GitHub App. */
@Public()
@SkipResponseEnvelope()
@Controller("v2/github")
export class GithubCallbackController {
	private readonly logger = new Logger(GithubCallbackController.name);

	constructor(
		@Inject(AUTH_INSTANCE)
		private readonly auth: Auth,
		@Inject(GithubAccountService)
		private readonly accounts: Pick<GithubAccountService, "handleCallback">,
	) {}

	@Get("callback")
	async callback(
		@Query(new ZodValidationPipe(githubCallbackQuerySchema))
		query: GithubCallbackQuery,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		let redirectUrl: string;
		try {
			// The session binding check needs the user of this browser; a public
			// route gets no `request.user`.
			const session = await this.auth.api.getSession({
				headers: toWebHeaders(request.headers),
			});
			redirectUrl = await this.accounts.handleCallback(
				query,
				session?.user.id ?? null,
			);
		} catch (error) {
			// A browser on a JSON error page is stuck. The web dashboard shows the code as a toast.
			this.logger.error(`GitHub callback failed: ${getErrorMessage(error)}`);
			const fallback = githubCallbackFallbackUrl();
			fallback.searchParams.set(GITHUB_ERROR_PARAM, "exchange_failed");
			redirectUrl = fallback.toString();
		}
		reply.redirect(redirectUrl, 302);
	}
}
