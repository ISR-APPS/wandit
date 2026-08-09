import type { ApiErrorResponse } from "@wandit/contracts";
import type { HttpChatTransportInitOptions, UIMessage } from "ai";

import { ApiClientError } from "@/lib/api-client";

type ChatFetch = NonNullable<HttpChatTransportInitOptions<UIMessage>["fetch"]>;

/**
 * DefaultChatTransport turns every non-2xx response into a plain Error. This
 * fetch middleware throws the app's typed error first so billing status,
 * server code, and credit details reach useChat unchanged.
 */
export function createStatusPreservingChatFetch(
	fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): ChatFetch {
	return async (input, init) => {
		const response = await fetchImpl(input, init);
		if (response.ok) {
			return response;
		}

		const payload = await readErrorPayload(response);
		if (payload) {
			throw new ApiClientError(payload.error, {
				hasServerEnvelopeMessage: true,
			});
		}

		throw new ApiClientError({
			code: `HTTP_${response.status}`,
			message: response.statusText || "Failed to fetch the chat response.",
			path: response.url || requestPath(input),
			requestId: response.headers.get("x-request-id") ?? "unknown",
			statusCode: response.status,
			timestamp: new Date().toISOString(),
		});
	};
}

async function readErrorPayload(
	response: Response,
): Promise<ApiErrorResponse | null> {
	try {
		const payload = (await response.clone().json()) as unknown;
		return isApiErrorResponse(payload) ? payload : null;
	} catch {
		return null;
	}
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
	if (typeof value !== "object" || value === null || !("error" in value)) {
		return false;
	}

	const error = (value as { error?: unknown }).error;
	return (
		typeof error === "object" &&
		error !== null &&
		typeof (error as Record<string, unknown>).code === "string" &&
		typeof (error as Record<string, unknown>).message === "string" &&
		typeof (error as Record<string, unknown>).path === "string" &&
		typeof (error as Record<string, unknown>).requestId === "string" &&
		typeof (error as Record<string, unknown>).statusCode === "number" &&
		typeof (error as Record<string, unknown>).timestamp === "string"
	);
}

function requestPath(input: Parameters<typeof fetch>[0]) {
	if (typeof input === "string") {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
}
