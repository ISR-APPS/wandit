import type { ApiErrorResponse } from "@wandit/contracts";

import { ApiClientError } from "@/shared/lib/base-service";

/**
 * DefaultChatTransport turns every non-2xx response into a plain Error. This
 * fetch middleware throws the app's typed ApiClientError first so the server
 * code (AI_CHAT_TURN_ACTIVE, AI_CHAT_OPERATION_REPLAYED), billing status and
 * credit details reach useChat unchanged (web parity:
 * status-preserving-chat-transport.ts).
 */
export function createStatusPreservingChatFetch(
	fetchImpl: typeof globalThis.fetch,
): typeof globalThis.fetch {
	return (async (
		input: Parameters<typeof globalThis.fetch>[0],
		init?: Parameters<typeof globalThis.fetch>[1],
	) => {
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
	}) as typeof globalThis.fetch;
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

function requestPath(input: Parameters<typeof globalThis.fetch>[0]) {
	if (typeof input === "string") {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
}
