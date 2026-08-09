/**
 * api-service.ts is the small "friendly wrapper" around BaseService.
 *
 * Feature services call ApiService.get/post/patch/etc. instead of calling axios
 * directly. In the chat flow, chat.services.ts uses this file to GET the chat
 * for a project, GET message history, and POST the user's new message. The
 * worker-generated assistant response does not return through this file; it is
 * pushed later over the SSE stream opened in use-project-chat.tsx.
 *
 * Important gotcha: the NestJS API normally wraps successful JSON as
 * { data, meta }. This wrapper strips that envelope and returns only `data`, so
 * feature files should parse the returned value with their @wandit/contracts
 * Zod schema for the inner payload, not the full envelope.
 */
// @wandit/contracts holds the shared response-envelope type. The actual runtime
// validation for chat payloads happens one layer up in chat.services.ts.
import type { ApiSuccessResponse } from "@wandit/contracts";
// Axios is the HTTP client library underneath this app's API layer. We keep it
// hidden here so feature code can use simple get/post helpers.
import type { AxiosRequestConfig } from "axios";

import BaseService from "@/lib/BaseService";

// One query-string value accepted by ApiService options. null/undefined are
// allowed because serializeQueryParams later skips them instead of sending
// "null" or "undefined" to the server.
export type ApiQueryValue = boolean | number | string | null | undefined;
// A query object can contain one value or an array of values per key, which lets
// callers build URLs like ?tag=a&tag=b without hand-writing URLSearchParams.
export type ApiQueryParams = Record<string, ApiQueryValue | ApiQueryValue[]>;

// Options accepted by the friendly get/post/etc. helpers. We remove axios's raw
// method/url/data/params fields so callers use this wrapper's names instead:
// `query` becomes axios `params`, and the HTTP method comes from the helper.
export type ApiRequestOptions<TBody = unknown> = Omit<
	AxiosRequestConfig<TBody>,
	"data" | "method" | "params" | "url"
> & {
	query?: ApiQueryParams;
	skipAuthRedirect?: boolean;
};

// The shared high-level API object imported by feature services. It delegates to
// BaseService for the actual request, then unwraps the server envelope before
// returning data to the caller.
export const ApiService = {
	// Escape hatch for callers that already have a full axios config object.
	request: <TData = unknown, TBody = unknown>(
		config: AxiosRequestConfig<TBody>,
	) => request<TData, TBody>(config),

	// Backwards-compatible alias for older code that used `fetchData`.
	fetchData: <TData = unknown, TBody = Record<string, unknown>>(
		config: AxiosRequestConfig<TBody>,
	) => request<TData, TBody>(config),

	// The five method helpers keep call sites short and keep query/body mapping
	// consistent across every feature service.
	get: <TData = unknown>(url: string, options?: ApiRequestOptions) =>
		request<TData>({ ...toAxiosOptions(options), method: "GET", url }),

	post: <TData = unknown, TBody = unknown>(
		url: string,
		data?: TBody,
		options?: ApiRequestOptions<TBody>,
	) =>
		request<TData, TBody>({
			...toAxiosOptions(options),
			data,
			method: "POST",
			url,
		}),

	put: <TData = unknown, TBody = unknown>(
		url: string,
		data?: TBody,
		options?: ApiRequestOptions<TBody>,
	) =>
		request<TData, TBody>({
			...toAxiosOptions(options),
			data,
			method: "PUT",
			url,
		}),

	patch: <TData = unknown, TBody = unknown>(
		url: string,
		data?: TBody,
		options?: ApiRequestOptions<TBody>,
	) =>
		request<TData, TBody>({
			...toAxiosOptions(options),
			data,
			method: "PATCH",
			url,
		}),

	delete: <TData = unknown>(url: string, options?: ApiRequestOptions) =>
		request<TData>({ ...toAxiosOptions(options), method: "DELETE", url }),
};

// Send one request through the lower-level axios instance and unwrap the JSON
// envelope. BaseService handles base URL, cookies, /api/v1 prefixing, timeout,
// and error normalization before control reaches this helper again.
async function request<TData, TBody = unknown>(
	config: AxiosRequestConfig<TBody>,
) {
	const response = await BaseService.request<ApiSuccessResponse<TData> | TData>(
		config,
	);

	return unwrapPayload<TData>(response.data);
}

// Convert this wrapper's `query` option into axios's `params` option. Keeping
// that translation here means feature services never need to import axios types
// just to add a query string.
function toAxiosOptions<TBody>(options?: ApiRequestOptions<TBody>) {
	if (!options) {
		return {};
	}

	const { query, ...axiosOptions } = options;

	return {
		...axiosOptions,
		params: query,
	};
}

// The API usually returns { data, meta }, but a few endpoints may intentionally
// bypass the envelope. This keeps both cases usable: envelopes return `data`,
// non-enveloped payloads pass through unchanged.
function unwrapPayload<TData>(payload: ApiSuccessResponse<TData> | TData) {
	if (isApiSuccessResponse<TData>(payload)) {
		return payload.data;
	}

	return payload;
}

// Runtime shape check for the success envelope. This is intentionally minimal:
// feature-specific schemas still validate the inner `data` payload afterward.
function isApiSuccessResponse<TData>(
	payload: ApiSuccessResponse<TData> | TData,
): payload is ApiSuccessResponse<TData> {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"data" in payload &&
		"meta" in payload
	);
}

// Default export for older imports; new code generally imports `apiClient` from
// api-client.ts, which points at this same object.
export default ApiService;
