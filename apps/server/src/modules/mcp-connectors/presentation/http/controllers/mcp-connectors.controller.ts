import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Inject,
	Logger,
	Param,
	Post,
	Query,
	Req,
	Res,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	MCP_ERROR_PARAM,
	type McpConnectorListItem,
	type McpConnectStartRequest,
	type McpConnectStartResponse,
	mcpConnectStartRequestSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SkipResponseEnvelope } from "../../../../../infrastructure/http/skip-envelope.decorator";
import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser, Public } from "../../../../auth";
import { McpOauthService } from "../../../application/services/mcp-oauth.service";

const connectorSlugSchema = z.string().min(1).max(100);

@Controller("v1/mcp/connectors")
export class McpConnectorsController {
	private readonly logger = new Logger(McpConnectorsController.name);

	constructor(
		@Inject(McpOauthService)
		private readonly oauthService: McpOauthService,
	) {}

	@Get()
	list(@CurrentUser() user: AuthUser): Promise<McpConnectorListItem[]> {
		return this.oauthService.list(user.id);
	}

	@Post(":slug/connect")
	@HttpCode(200)
	startConnect(
		@Param("slug", new ZodValidationPipe(connectorSlugSchema))
		slug: string,
		@Body(new ZodValidationPipe(mcpConnectStartRequestSchema))
		body: McpConnectStartRequest,
		@CurrentUser() user: AuthUser,
	): Promise<McpConnectStartResponse> {
		return this.oauthService.startConnect(user.id, slug, body.returnUrl);
	}

	@Get("callback")
	@Public()
	@SkipResponseEnvelope()
	async callback(
		@Query("state") state: unknown,
		@Query("code") code: unknown,
		@Query("error") error: unknown,
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	): Promise<void> {
		let redirectUrl: string;

		try {
			redirectUrl = await this.oauthService.handleCallback(
				{
					code: queryString(code),
					error: queryString(error),
					state: queryString(state),
				},
				request.headers,
			);
		} catch (callbackError) {
			this.logger.error(
				`MCP OAuth callback failed: ${errorName(callbackError)}`,
			);
			const fallback = new URL(env.CORS_ORIGIN);
			fallback.searchParams.set(MCP_ERROR_PARAM, "exchange_failed");
			redirectUrl = fallback.toString();
		}

		reply.redirect(redirectUrl, 302);
	}

	@Delete(":slug")
	disconnect(
		@Param("slug", new ZodValidationPipe(connectorSlugSchema))
		slug: string,
		@CurrentUser() user: AuthUser,
	): Promise<McpConnectorListItem> {
		return this.oauthService.disconnect(user.id, slug);
	}
}

function queryString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function errorName(error: unknown): string {
	return error instanceof Error ? error.name : "UnknownError";
}
