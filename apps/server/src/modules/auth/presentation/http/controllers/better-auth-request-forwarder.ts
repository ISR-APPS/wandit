import { HttpException, HttpStatus, type Logger } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { toWebHeaders } from "../../../../../infrastructure/http/fastify-headers";

type BetterAuthHandler = {
	handler: (request: Request) => Promise<Response>;
};

export async function forwardBetterAuthRequest(
	auth: BetterAuthHandler,
	request: FastifyRequest,
	reply: FastifyReply,
	logger: Logger,
): Promise<void> {
	try {
		const response = await auth.handler(toWebRequest(request));

		reply.status(response.status);
		copyResponseHeaders(response, reply);

		const body = response.body ? await response.text() : null;
		reply.send(body);
	} catch (error) {
		logger.error("Authentication request failed", error);
		throw new HttpException(
			{
				code: "AUTH_FAILURE",
				message: "Internal authentication error",
			},
			HttpStatus.INTERNAL_SERVER_ERROR,
		);
	}
}

function toWebRequest(request: FastifyRequest): Request {
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

function copyResponseHeaders(response: Response, reply: FastifyReply): void {
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
