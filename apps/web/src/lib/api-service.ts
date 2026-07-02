import type { ApiSuccessResponse } from "@wandit/contracts";
import type { AxiosRequestConfig } from "axios";

import BaseService from "@/lib/BaseService";

export type ApiQueryValue = boolean | number | string | null | undefined;
export type ApiQueryParams = Record<string, ApiQueryValue | ApiQueryValue[]>;

export type ApiRequestOptions<TBody = unknown> = Omit<
	AxiosRequestConfig<TBody>,
	"data" | "method" | "params" | "url"
> & {
	query?: ApiQueryParams;
	skipAuthRedirect?: boolean;
};

export const ApiService = {
	request: <TData = unknown, TBody = unknown>(
		config: AxiosRequestConfig<TBody>,
	) => request<TData, TBody>(config),

	fetchData: <TData = unknown, TBody = Record<string, unknown>>(
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

async function request<TData, TBody = unknown>(
	config: AxiosRequestConfig<TBody>,
) {
	const response = await BaseService.request<ApiSuccessResponse<TData> | TData>(
		config,
	);

	return unwrapPayload<TData>(response.data);
}

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

function unwrapPayload<TData>(payload: ApiSuccessResponse<TData> | TData) {
	if (isApiSuccessResponse<TData>(payload)) {
		return payload.data;
	}

	return payload;
}

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
