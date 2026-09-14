/**
 * Fastify controller for the V2 LLM proxy, Anthropic inbound format.
 * `@Public()`: the run token in `Authorization: Bearer` is the only auth.
 * `@SkipResponseEnvelope()`: the answer is the raw upstream body.
 * `LlmProxyService` does all checks, the forward, and the usage row.
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
	type LlmProxyInboundRequest,
	type LlmProxyReply,
	LlmProxyService,
} from "../../../application/services/llm-proxy.service";

/** Writes the proxied answer onto a hijacked Fastify reply. */
class FastifyProxyReply implements LlmProxyReply {
	constructor(private readonly reply: FastifyReply) {}

	writeHead(statusCode: number, headers: Record<string, string>): void {
		// Hijack takes the response off Fastify's serializer so the upstream
		// bytes and status reach the client untouched.
		this.reply.hijack();
		this.reply.raw.writeHead(statusCode, headers);
	}

	async write(chunk: Uint8Array): Promise<void> {
		const raw = this.reply.raw;
		if (raw.write(chunk)) {
			return;
		}
		// Backpressure: pause the upstream pump until the socket drains,
		// closes, or errors. The abort signal covers the close/error cases.
		await new Promise<void>((resolve) => {
			const done = () => {
				raw.off("drain", done);
				raw.off("close", done);
				raw.off("error", done);
				resolve();
			};
			raw.once("drain", done);
			raw.once("close", done);
			raw.once("error", done);
		});
	}

	end(): void {
		this.reply.raw.end();
	}
}

/**
 * The two POST routes of the proxy, `/v2/llm/v1/messages` and
 * `/v2/llm/v1/messages/count_tokens`. `main.ts` sets their 4 MiB body
 * limit at route registration.
 */
@Public()
@SkipResponseEnvelope()
@Controller("v2/llm")
export class LlmProxyController {
	constructor(
		@Inject(LlmProxyService) private readonly llmProxy: LlmProxyService,
	) {}

	@Post("v1/messages")
	messages(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		return this.proxy(request, reply, "messages");
	}

	@Post("v1/messages/count_tokens")
	countTokens(
		@Req() request: RawBodyRequest<FastifyRequest>,
		@Res() reply: FastifyReply,
	): Promise<void> {
		return this.proxy(request, reply, "count_tokens");
	}

	private async proxy(
		request: RawBodyRequest<FastifyRequest>,
		reply: FastifyReply,
		endpoint: LlmProxyInboundRequest["endpoint"],
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
		try {
			await this.llmProxy.proxyAnthropic(
				toInbound(request, endpoint, abort.signal),
				new FastifyProxyReply(reply),
			);
		} finally {
			reply.raw.off("close", onClose);
		}
	}
}

function firstHeader(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/**
 * The three request fields `toInbound` reads. A Fastify request satisfies
 * it; the spec passes a plain object.
 */
export type InboundSource = {
	headers: FastifyRequest["headers"];
	/** The exact body bytes; absent when the client sent no body. */
	rawBody?: Buffer;
	raw: { url?: string };
};

/** Maps the raw request onto the proxy input; the query string keeps a "?" inside a value. */
export function toInbound(
	request: InboundSource,
	endpoint: LlmProxyInboundRequest["endpoint"],
	abortSignal: AbortSignal,
): LlmProxyInboundRequest {
	// A query value can itself contain "?", so cut only at the first one.
	const rawUrl = request.raw.url;
	const queryStart = rawUrl?.indexOf("?") ?? -1;
	return {
		authorization: firstHeader(request.headers.authorization),
		anthropicVersion: firstHeader(request.headers["anthropic-version"]),
		anthropicBeta: firstHeader(request.headers["anthropic-beta"]),
		wanditRun: firstHeader(request.headers["x-wandit-run"]),
		claudeSessionId: firstHeader(request.headers["x-claude-code-session-id"]),
		// rawBody keeps the exact bytes so `cache_control` and prompt fields
		// reach upstream untouched.
		body: request.rawBody ?? Buffer.alloc(0),
		endpoint,
		queryString:
			rawUrl === undefined || queryStart === -1
				? undefined
				: rawUrl.slice(queryStart + 1),
		abortSignal,
	};
}
