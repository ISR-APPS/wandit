import {
	All,
	Controller,
	HttpException,
	HttpStatus,
	Logger,
	Req,
	Res,
} from "@nestjs/common";
import { auth } from "@wandit/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

@Controller("auth")
export class AuthController {
	private readonly logger = new Logger(AuthController.name);

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
			const response = await auth.handler(this.toWebRequest(request));

			reply.status(response.status);
			this.copyResponseHeaders(response, reply);

			const body = response.body ? await response.text() : null;
			reply.send(body);
		} catch (error) {
			this.logger.error("Authentication request failed", error);
			throw new HttpException(
				{
					code: "AUTH_FAILURE",
					message: "Internal authentication error",
				},
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
	}

	private toWebRequest(request: FastifyRequest) {
		const url = new URL(request.url, `http://${request.headers.host}`);
		const headers = new Headers();

		for (const [key, value] of Object.entries(request.headers)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					headers.append(key, item);
				}
				continue;
			}

			if (value !== undefined) {
				headers.append(key, String(value));
			}
		}

		const requestInit: RequestInit = {
			headers,
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
