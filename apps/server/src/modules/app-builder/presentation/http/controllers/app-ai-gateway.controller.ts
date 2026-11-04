/**
 * Fastify controller of the app AI gateway, OpenAI chat format.
 * A V2 app's Supabase Edge Function calls it with its per-project key.
 * `@Public()`: the key in `Authorization: Bearer` is the only auth. No CORS
 * change: a browser must never hold the key. `AppAiGatewayService` does the
 * checks, the forward, and the bill.
 */
import {
	Controller,
	Inject,
	Post,
	type RawBodyRequest,
	Req,
	Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { Public } from "../../../../auth";
import {
	AppAiGatewayService,
	UPSTREAM_TIMEOUT_MS,
} from "../../../application/services/app-ai-gateway.service";
import { FastifyProxyReply } from "./llm-proxy.controller";

/**
 * `POST /api/v2/ai/v1/chat/completions`. `main.ts` sets its 4 MiB body
 * limit at route registration, for images as data URLs.
 */
@Public()
@SkipResponseEnvelope()
@Controller("v2/ai/v1")
export class AppAiGatewayController {
	constructor(
		@Inject(AppAiGatewayService) private readonly gateway: AppAiGatewayService,
	) {}

	@Post("chat/completions")
	async chatCompletions(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const abort = new AbortController();
		// `close` fires on client abort and on normal end; `writableEnded`
		// tells them apart.
		const onClose = () => {
			if (!reply.raw.writableEnded) {
				abort.abort();
			}
		};
		reply.raw.once("close", onClose);
		// A client that left before the line above never fires `close` again.
		if (reply.raw.destroyed) {
			abort.abort();
		}
		// Money: a client that stops reading blocks each write, so the hold
		// stays reserved until the sweep refunds it for free. Closing the
		// socket ends the write, and the call settles.
		const deadline = setTimeout(() => {
			if (!reply.raw.writableEnded) {
				reply.raw.destroy();
			}
		}, UPSTREAM_TIMEOUT_MS);
		try {
			await this.gateway.chatCompletions(
				{
					authorization: request.headers.authorization,
					body: request.rawBody ?? Buffer.alloc(0),
					abortSignal: abort.signal,
				},
				new FastifyProxyReply(reply),
			);
		} finally {
			clearTimeout(deadline);
			reply.raw.off("close", onClose);
		}
	}
}
