import type { ApiErrorResponse } from "@wandit/contracts";
import type {
	AxiosResponse,
	InternalAxiosRequestConfig,
	RawAxiosRequestHeaders,
} from "axios";
import axios, { AxiosHeaders } from "axios";

import { redirectToLoginAfterUnauthorized } from "@/lib/auth-navigation";
import { getServerUrl } from "@/lib/server-url";

const API_VERSION_PREFIX = "/api/v1";
const REQUEST_TIMEOUT_MS = 60_000;

export type ApiErrorPayload = ApiErrorResponse["error"];
export type ApiValidationErrorDetail = {
	field: string;
	messages: string[];
};

export class ApiClientError extends Error {
	readonly code: string;
	readonly details: unknown;
	readonly path: string;
	readonly requestId: string;
	readonly statusCode: number;
	readonly timestamp: string;

	constructor(error: ApiErrorPayload, options?: { cause?: unknown }) {
		super(error.message, options);
		this.name = "ApiClientError";
		this.code = error.code;
		this.details = error.details;
		this.path = error.path;
		this.requestId = error.requestId;
		this.statusCode = error.statusCode;
		this.timestamp = error.timestamp;
	}
}

export const BaseService = axios.create({
	baseURL: getServerUrl(),
	headers: {
		Accept: "application/json",
	},
	paramsSerializer: {
		serialize: serializeQueryParams,
	},
	timeout: REQUEST_TIMEOUT_MS,
	withCredentials: true,
});

BaseService.interceptors.request.use((config) => {
	config.url = normalizeApiPath(config.url);
	applyDefaultHeaders(config);

	return config;
});

BaseService.interceptors.response.use(
	(response) => response,
	(error: unknown) => {
		const apiError = toApiClientError(error);

		if (apiError.statusCode === 401 && shouldRedirectAfterUnauthorized(error)) {
			redirectToLoginAfterUnauthorized();
		}

		return Promise.reject(apiError);
	},
);

export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}

export function isUnauthorizedApiError(error: unknown) {
	return isApiClientError(error) && error.statusCode === 401;
}

export function getApiErrorMessage(error: unknown) {
	if (isApiClientError(error)) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "An unexpected error occurred";
}

export function getApiValidationErrors(error: unknown) {
	if (!isApiClientError(error) || !Array.isArray(error.details)) {
		return [];
	}

	return error.details.filter(isApiValidationErrorDetail);
}

export function getApiFieldError(error: unknown, field: string) {
	return getApiValidationErrors(error).find((detail) => detail.field === field)
		?.messages[0];
}

function applyDefaultHeaders(config: InternalAxiosRequestConfig) {
	const headers = AxiosHeaders.from(config.headers);

	if (!headers.get("Accept")) {
		headers.set("Accept", "application/json");
	}

	config.headers = headers;
}

function normalizeApiPath(url: string | undefined) {
	if (!url || isAbsoluteUrl(url)) {
		return url;
	}

	const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

	if (normalizedUrl.startsWith("/api/")) {
		return normalizedUrl;
	}

	return `${API_VERSION_PREFIX}${normalizedUrl}`;
}

function serializeQueryParams(params: Record<string, unknown>) {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== null && item !== undefined) {
				searchParams.append(key, String(item));
			}
		}
	}

	return searchParams.toString();
}

function toApiClientError(error: unknown) {
	if (isApiClientError(error)) {
		return error;
	}

	if (axios.isAxiosError(error)) {
		const payload = error.response?.data;

		if (isApiErrorResponse(payload)) {
			return new ApiClientError(payload.error, { cause: error });
		}

		return new ApiClientError(
			{
				code: error.response
					? `HTTP_${error.response.status}`
					: "NETWORK_ERROR",
				message:
					error.response?.statusText ||
					error.message ||
					"Network request failed",
				path: buildErrorPath(error.config),
				requestId: readResponseHeader(error.response, "x-request-id"),
				statusCode: error.response?.status ?? 0,
				timestamp: new Date().toISOString(),
			},
			{ cause: error },
		);
	}

	if (error instanceof Error) {
		return new ApiClientError(
			{
				code: "CLIENT_ERROR",
				message: error.message,
				path: "unknown",
				requestId: "unknown",
				statusCode: 0,
				timestamp: new Date().toISOString(),
			},
			{ cause: error },
		);
	}

	return new ApiClientError({
		code: "CLIENT_ERROR",
		message: "An unexpected error occurred",
		path: "unknown",
		requestId: "unknown",
		statusCode: 0,
		timestamp: new Date().toISOString(),
	});
}

function shouldRedirectAfterUnauthorized(error: unknown) {
	if (!axios.isAxiosError(error)) {
		return true;
	}

	return !(
		error.config as
			| (InternalAxiosRequestConfig & {
					skipAuthRedirect?: boolean;
			  })
			| null
	)?.skipAuthRedirect;
}

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"error" in payload &&
		typeof (payload as ApiErrorResponse).error?.message === "string"
	);
}

function isApiValidationErrorDetail(
	value: unknown,
): value is ApiValidationErrorDetail {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ApiValidationErrorDetail).field === "string" &&
		Array.isArray((value as ApiValidationErrorDetail).messages) &&
		(value as ApiValidationErrorDetail).messages.every(
			(message) => typeof message === "string",
		)
	);
}

function buildErrorPath(config: InternalAxiosRequestConfig | undefined) {
	if (!config?.url) {
		return "unknown";
	}

	if (isAbsoluteUrl(config.url)) {
		return config.url;
	}

	return `${config.baseURL ?? getServerUrl()}${config.url}`;
}

function readResponseHeader(
	response: AxiosResponse | undefined,
	name: keyof RawAxiosRequestHeaders | string,
) {
	const value = response?.headers?.[name] ?? response?.headers?.[String(name)];

	if (Array.isArray(value)) {
		return value.join(", ");
	}

	if (typeof value === "string") {
		return value;
	}

	return "unknown";
}

function isAbsoluteUrl(value: string) {
	return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

export default BaseService;
