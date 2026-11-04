/**
 * `POST /api/mcp`, the Wandit remote MCP server (docs/features/coding-agents-mcp.md, "MCP request rules").
 * External coding agents send one JSON-RPC message per POST with an OAuth access token.
 * The guards prove the token, the V2 gate, and the request bucket. Then a new MCP SDK handler
 * serves the message with the tools of `McpTools`. GET and DELETE answer 405: no session exists.
 */
import { type AuthInfo, createMcpHandler } from "@modelcontextprotocol/server";
import {
	Controller,
	Delete,
	Get,
	Inject,
	Post,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
} from "@nestjs/common";
import {
	MCP_PROTECTED_RESOURCE_METADATA_URL,
	MCP_RESOURCE_URL,
} from "@wandit/auth/mcp-oauth-provider";
import { mcpJsonRpcEnvelopeSchema } from "@wandit/contracts";
import type { FastifyReply } from "fastify";

import {
	readClientIp,
	readTrustedClientIp,
} from "../../../../../infrastructure/http/client-ip";
import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { Public } from "../../../../auth";
import { type McpRequest, McpTokenGuard } from "../guards/mcp-token.guard";
import {
	RateLimit,
	type RateLimitOptions,
	RedisRateLimitGuard,
} from "../guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { type McpCallContext, McpTools } from "./mcp-tools";

/**
 * Every MCP message, reads included: 600 per user and 1,800 per IP in 10 min, one per second
 * on average. The write, builder, and deploy tools also count in their own buckets.
 */
const MCP_REQUEST_RATE_LIMIT = {
	ipLimit: 1_800,
	key: "mcp-request",
	limit: 600,
	windowMs: 10 * 60_000,
} satisfies RateLimitOptions;

// Security: the SDK never needs the credentials, so the copied request does not carry them.
// The body is passed parsed, so its length header does not apply to the copy.
const DROPPED_REQUEST_HEADERS = new Set([
	"authorization",
	"cookie",
	"content-length",
]);

// The SDK sets these for its own stream. Fastify sends the whole text and sets its own length.
const DROPPED_RESPONSE_HEADERS = new Set([
	"connection",
	"content-length",
	"keep-alive",
	"transfer-encoding",
]);

// JSON-RPC 2.0 "Invalid Request". The refusals below use it.
const JSON_RPC_INVALID_REQUEST = -32_600;

/** Serves `/api/mcp` with no MCP session: the bearer token and the guards prove each POST again. */
@Controller("mcp")
export class McpController {
	constructor(@Inject(McpTools) private readonly tools: McpTools) {}

	// `@Public()` turns off the cookie session. `McpTokenGuard` proves the bearer token instead.
	@Public()
	@UseGuards(McpTokenGuard, V2BuilderEnabledGuard, RedisRateLimitGuard)
	@RateLimit(MCP_REQUEST_RATE_LIMIT)
	@SkipResponseEnvelope()
	@Post()
	async handle(
		@Req() request: McpRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		const user = request.user;
		const grant = request.mcpGrant;
		// McpTokenGuard sets both. A missing value means a wiring bug, so the answer is closed.
		if (user === undefined || grant === undefined) {
			throw new UnauthorizedException();
		}
		// Product rule: one message per POST. A batch would run many tools under one rate hit.
		if (Array.isArray(request.body)) {
			await sendJsonRpcRefusal(reply, null, "Batch requests are not supported");
			return;
		}
		// `subscriptions/listen` opens an SSE stream that never ends. No tool sends change events.
		const envelope = mcpJsonRpcEnvelopeSchema.safeParse(request.body);
		if (envelope.success && envelope.data.method === "subscriptions/listen") {
			await sendJsonRpcRefusal(
				reply,
				envelope.data.id ?? null,
				"subscriptions/listen is not supported",
			);
			return;
		}

		const call: McpCallContext = {
			clientId: grant.clientId,
			clientIp: readClientIp(request),
			trustedClientIp: readTrustedClientIp(request),
			userId: user.id,
		};
		const authInfo: AuthInfo = {
			clientId: grant.clientId,
			expiresAt: grant.expiresAt,
			resource: new URL(MCP_RESOURCE_URL),
			// The SDK puts it into the 403 `insufficient_scope` challenge of a tool.
			resourceMetadataUrl: MCP_PROTECTED_RESOURCE_METADATA_URL,
			scopes: grant.scopes,
			// Security: no token passthrough. No tool reads the token, so the SDK never holds it.
			token: "",
		};
		// A new handler and server for each POST: each server holds the tools of one caller only.
		const handler = createMcpHandler(() => this.tools.createServer(call), {
			legacy: "stateless",
			responseMode: "json",
		});
		try {
			const response = await handler.fetch(
				new Request(MCP_RESOURCE_URL, {
					headers: forwardedHeadersOf(request),
					method: "POST",
				}),
				{ authInfo, parsedBody: request.body },
			);
			// The legacy leg answers one SSE event and ends the stream. The text holds the whole answer.
			const body = await response.text();
			reply.status(response.status);
			response.headers.forEach((value, name) => {
				if (!DROPPED_RESPONSE_HEADERS.has(name)) {
					reply.header(name, value);
				}
			});
			await reply.send(body);
		} finally {
			await handler.close();
		}
	}

	// MCP Streamable HTTP: a server without sessions answers GET with 405.
	@Public()
	@SkipResponseEnvelope()
	@Get()
	async refuseGet(@Res() reply: FastifyReply): Promise<void> {
		await sendMethodNotAllowed(reply);
	}

	// MCP Streamable HTTP: DELETE ends a session. This server has none.
	@Public()
	@SkipResponseEnvelope()
	@Delete()
	async refuseDelete(@Res() reply: FastifyReply): Promise<void> {
		await sendMethodNotAllowed(reply);
	}
}

/** The request headers for the SDK, without the credentials. A repeated header joins with ", ". */
function forwardedHeadersOf(request: McpRequest): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(request.headers)) {
		if (value !== undefined && !DROPPED_REQUEST_HEADERS.has(name)) {
			headers.set(name, Array.isArray(value) ? value.join(", ") : value);
		}
	}
	return headers;
}

async function sendJsonRpcRefusal(
	reply: FastifyReply,
	id: string | number | null,
	message: string,
): Promise<void> {
	await reply.status(400).send({
		error: { code: JSON_RPC_INVALID_REQUEST, message },
		id,
		jsonrpc: "2.0",
	});
}

async function sendMethodNotAllowed(reply: FastifyReply): Promise<void> {
	await reply
		.status(405)
		.header("Allow", "POST")
		.send({
			error: { code: JSON_RPC_INVALID_REQUEST, message: "Method not allowed" },
			id: null,
			jsonrpc: "2.0",
		});
}
