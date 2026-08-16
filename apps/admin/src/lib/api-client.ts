// Minimal typed fetch client for the admin app. All admin API responses use
// the shared { data, meta } envelope; errors use { error: { code, message,
// statusCode, ... } }. This client unwraps the envelope and normalizes every
// failure into ApiClientError. It NEVER redirects — the route guard owns
// redirects, so a 401/404 from an admin endpoint simply rejects.
import { getServerUrl } from "./server-url";

export type ApiQueryParams = Record<
	string,
	string | number | boolean | null | undefined
>;

export class ApiClientError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(input: { status: number; code: string; message: string }) {
		super(input.message);
		this.name = "ApiClientError";
		this.status = input.status;
		this.code = input.code;
	}
}

export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}

export function apiGet<T>(path: string, params?: ApiQueryParams): Promise<T> {
	return request<T>(path, { method: "GET", params });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, { method: "PATCH", body });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, { method: "DELETE", body });
}

/**
 * Authenticated GET for endpoints that intentionally bypass the JSON envelope,
 * such as CSV exports. The caller owns reading the successful response body.
 */
export async function apiGetRaw(
	path: string,
	params?: ApiQueryParams,
	accept = "*/*",
): Promise<Response> {
	const response = await fetchResponse(path, {
		method: "GET",
		params,
		accept,
	});

	if (!response.ok) {
		throw toApiClientError(response, await parseJson(response));
	}

	return response;
}

type RequestOptions = {
	method: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	params?: ApiQueryParams;
	accept?: string;
};

async function request<T>(path: string, options: RequestOptions): Promise<T> {
	const response = await fetchResponse(path, options);

	if (response.status === 204) {
		return undefined as T;
	}

	const payload = await parseJson(response);

	if (!response.ok) {
		throw toApiClientError(response, payload);
	}

	if (!isRecord(payload) || !("data" in payload)) {
		throw new ApiClientError({
			status: response.status,
			code: "INVALID_RESPONSE",
			message: "The server returned an invalid response.",
		});
	}

	return payload.data as T;
}

async function fetchResponse(
	path: string,
	{ method, body, params, accept = "application/json" }: RequestOptions,
): Promise<Response> {
	const headers: Record<string, string> = { Accept: accept };
	const isWrite = method !== "GET";

	if (isWrite) {
		headers["Content-Type"] = "application/json";
	}

	try {
		return await fetch(buildApiUrl(path, params), {
			method,
			headers,
			body: isWrite ? JSON.stringify(body ?? {}) : undefined,
			credentials: "include",
		});
	} catch (cause) {
		throw new ApiClientError({
			status: 0,
			code: "NETWORK_ERROR",
			message:
				cause instanceof Error && cause.message
					? cause.message
					: "The server could not be reached.",
		});
	}
}

export function buildApiUrl(path: string, params?: ApiQueryParams): string {
	const url = `${getServerUrl()}${path}`;

	if (!params) {
		return url;
	}

	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null) {
			search.append(key, String(value));
		}
	}

	const query = search.toString();
	return query ? `${url}?${query}` : url;
}

async function parseJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function toApiClientError(
	response: Response,
	payload: unknown,
): ApiClientError {
	const envelopeError =
		typeof payload === "object" && payload !== null && "error" in payload
			? (payload as { error?: Record<string, unknown> }).error
			: undefined;

	return new ApiClientError({
		status:
			typeof envelopeError?.statusCode === "number"
				? envelopeError.statusCode
				: response.status,
		code:
			typeof envelopeError?.code === "string"
				? envelopeError.code
				: `HTTP_${response.status}`,
		message:
			typeof envelopeError?.message === "string"
				? envelopeError.message
				: response.statusText || "The request failed.",
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
