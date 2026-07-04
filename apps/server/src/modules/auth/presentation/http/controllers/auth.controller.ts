import {
	All,
	Controller,
	HttpException,
	HttpStatus,
	Inject,
	Logger,
	Req,
	Res,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";
import { AUTH_INSTANCE } from "../../../auth.constants";
import { Public } from "../decorators/public.decorator";

@Public()
@Controller("auth")
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

	constructor(@Inject(AUTH_INSTANCE) private readonly auth: Auth) {}

	@All()
	async handleAuthRoot(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await this.handleAuthRequest(request, reply);
	}

	@All("*")
	async handleAuthPath(
		@Req() request: FastifyRequest,
		@Res() reply: FastifyReply,
	) {
		await this.handleAuthRequest(request, reply);
	}

	private async handleAuthRequest(
		request: FastifyRequest,
		reply: FastifyReply,
	) {
		try {
			const response = await this.auth.handler(this.toWebRequest(request));

			reply.status(response.status);
			this.copyResponseHeaders(response, reply);

			const body = response.body ? await response.text() : null;
			reply.send(body);
		} catch (error) {
			this.logger.error("Authentication request failed", error);
			throw new HttpException(
				{
					code: "AUTH_FAILURE",
					error: "Internal authentication error",
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	private toWebRequest(request: FastifyRequest) {
		const url = new URL(request.url, `http://${request.headers.host}`);

		const requestInit: RequestInit = {
			headers: toWebHeaders(request.headers),
			method: request.method,
		};

		if (request.body !== undefined && request.body !== null) {
			requestInit.body =
				typeof request.body === "string"
					? request.body
					: JSON.stringify(request.body);
		}

		return new Request(url.toString(), requestInit);
	}

	private copyResponseHeaders(response: Response, reply: FastifyReply) {
		const headersWithCookies = response.headers as Headers & {
			getSetCookie?: () => string[];
		};
		const setCookieHeaders = headersWithCookies.getSetCookie?.() ?? [];

		response.headers.forEach((value, key) => {
			if (key.toLowerCase() !== "set-cookie") {
				reply.header(key, value);
			}
		});

		for (const cookie of setCookieHeaders) {
			reply.header("set-cookie", cookie);
		}
	}
}
