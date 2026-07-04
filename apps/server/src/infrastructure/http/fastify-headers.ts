import type { FastifyRequest } from "fastify";

export function toWebHeaders(
	requestHeaders: FastifyRequest["headers"],
): globalThis.Headers {
	const headers = new Headers();

	for (const [key, value] of Object.entries(requestHeaders)) {
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

	return headers;
}
