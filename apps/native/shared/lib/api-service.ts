/**
 * api-service.ts — the small "friendly wrapper" around base-service.
 *
 * Feature request files call ApiService.get/post/patch/etc. instead of touching
 * axios directly. This is a near-identical port of the web app's api-service.ts,
 * because this layer is platform-agnostic: it just maps friendly options onto an
 * axios config and unwraps the server's { data, meta } envelope.
 *
 * Gotcha: the NestJS API wraps successful JSON as { data, meta }. This wrapper
 * strips that envelope and returns only `data`, so feature request files should
 * validate the returned value with their Zod schema (ideally from @wandit/contracts).
 */
import type { ApiSuccessResponse } from "@wandit/contracts";
import type { AxiosRequestConfig } from "axios";

import BaseService from "@/shared/lib/base-service";

// One query-string value. null/undefined are allowed because the serializer skips
// them instead of sending the literal text "null"/"undefined".
export type ApiQueryValue = boolean | number | string | null | undefined;
// A query object can hold one value or an array per key (?tag=a&tag=b).
export type ApiQueryParams = Record<string, ApiQueryValue | ApiQueryValue[]>;

// Options for the friendly helpers. We drop axios's raw method/url/data/params so
// callers use this wrapper's names: `query` maps to axios `params`, and the HTTP
// method comes from the helper name.
export type ApiRequestOptions<TBody = unknown> = Omit<
	AxiosRequestConfig<TBody>,
	"data" | "method" | "params" | "url"
> & {
	query?: ApiQueryParams;
	skipAuthRedirect?: boolean;
};

// The shared high-level API object imported by feature request files. It delegates
// to BaseService for the real request, then unwraps the envelope.
export const ApiService = {
	// Escape hatch for callers that already have a full axios config object.
	request: <TData = unknown, TBody = unknown>(
		config: AxiosRequestConfig<TBody>,
	) => request<TData, TBody>(config),

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

// Send one request through axios and unwrap the JSON envelope. BaseService handles
// base URL, cookie, /api/v1 prefixing, timeout, and error normalization.
async function request<TData, TBody = unknown>(
	config: AxiosRequestConfig<TBody>,
) {
	const response = await BaseService.request<ApiSuccessResponse<TData> | TData>(
		config,
	);

	return unwrapPayload<TData>(response.data);
}

// Convert this wrapper's `query` option into axios's `params`. Keeping the
// translation here means feature files never import axios types just to add a
// query string.
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

// The API usually returns { data, meta }, but a few endpoints may bypass the
// envelope. Envelopes return `data`; non-enveloped payloads pass through.
function unwrapPayload<TData>(payload: ApiSuccessResponse<TData> | TData) {
	if (isApiSuccessResponse<TData>(payload)) {
		return payload.data;
	}

	return payload;
}

// Minimal runtime check for the success envelope. Feature schemas still validate
// the inner `data` afterward.
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

export default ApiService;
