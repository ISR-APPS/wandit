/**
 * `POST /api/v2/github/webhook`: GitHub sends the webhook deliveries of the Wandit GitHub App here.
 * It is `@Public()`, because GitHub has no session. The HMAC check of `X-Hub-Signature-256`
 * through `GithubAppClient` is the gate, and it runs before any body or database read.
 * A `push` to `main` calls `GithubProjectService.handlePush`, which queues the sync run.
 */
import {
	BadRequestException,
	Controller,
	Headers,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
	type RawBodyRequest,
	Req,
	UnauthorizedException,
} from "@nestjs/common";
import { githubPushEventSchema } from "@wandit/contracts";
import type { FastifyRequest } from "fastify";

import { Public } from "../../../../auth";
import { GithubProjectService } from "../../../application/services/github-project.service";
import { GithubAppClient } from "../../../infrastructure/github/github-app.client";

/** The public webhook route of the GitHub App. */
@Public()
@Controller("v2/github")
export class GithubWebhookController {
	constructor(
		@Inject(GithubAppClient)
		private readonly github: Pick<GithubAppClient, "isValidWebhookSignature">,
		@Inject(GithubProjectService)
		private readonly projects: Pick<GithubProjectService, "handlePush">,
	) {}

	// LIMIT: Fastify refuses a body above 1 MiB with 413, for example a push with
	// huge file lists. The 10 min status check finds that push. Upgrade: raise
	// the body limit of this route in `main.ts`.
	@Post("webhook")
	@HttpCode(HttpStatus.OK)
	async receive(
		@Req() request: RawBodyRequest<FastifyRequest>,
		/** `sha256=<hex>`: the HMAC SHA-256 of the raw body with the webhook secret. */
		@Headers("x-hub-signature-256") signature: string | undefined,
		/** The event name, for example `push` or `ping`. */
		@Headers("x-github-event") event: string | undefined,
	): Promise<{ received: true }> {
		// The signature covers the exact bytes, so a missing raw body cannot be checked.
		if (request.rawBody === undefined) {
			throw new BadRequestException({
				code: "BAD_REQUEST",
				message: "The GitHub webhook body is missing",
			});
		}
		// Security: only GitHub knows the secret. Without a good signature, nothing runs.
		if (!this.github.isValidWebhookSignature(request.rawBody, signature)) {
			throw new UnauthorizedException({
				code: "GITHUB_WEBHOOK_SIGNATURE_INVALID",
				message: "Invalid GitHub webhook signature",
			});
		}
		// GitHub sends `ping` when the webhook is set up. The App subscribes to `push` only.
		if (event !== "push") {
			return { received: true };
		}
		const push = githubPushEventSchema.safeParse(request.body);
		if (!push.success) {
			throw new BadRequestException({
				code: "BAD_REQUEST",
				message: "The GitHub push delivery has no ref or repository id",
			});
		}
		// The sync follows GitHub `main` only. A push to another branch changes nothing.
		if (push.data.ref !== "refs/heads/main") {
			return { received: true };
		}
		await this.projects.handlePush(push.data.repository.id);
		return { received: true };
	}
}
