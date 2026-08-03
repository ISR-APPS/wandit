/**
 * BaseService.ts is the lowest shared HTTP layer in the web app.
 *
 * Everything that uses apiClient eventually comes through this axios instance.
 * In the chat flow, chat.services.ts calls apiClient, api-service.ts delegates
 * here, and this file sends the real request to the NestJS API with the correct
 * base URL, cookies, /api/v1 prefix, and timeout.
 *
 * This file does not know about chat-specific shapes. Its job is transport:
 * normalize request paths, preserve better-auth cookies, turn all failures into
 * ApiClientError, and redirect to the auth modal/landing page after most 401s.
 * The SSE chat stream is a gotcha: EventSource is opened directly elsewhere and
 * does not pass through this axios client or the JSON envelope handling here.
 */
// @wandit/contracts contains the shared API error envelope emitted by the
// NestJS exception filter. This client normalizes that envelope for UI code.
import type { ApiErrorResponse } from "@wandit/contracts";
import type {
	AxiosResponse,
	InternalAxiosRequestConfig,
	RawAxiosRequestHeaders,
} from "axios";
// Axios is the HTTP client library underneath apiClient. An axios "instance"
// lets the app define shared defaults and interceptors once for every request.
import axios, { AxiosHeaders } from "axios";

import { dispatchBillingError } from "@/features/billing/lib/billing-error-dispatch";
import { workspaceScopeHeaders } from "@/features/workspaces/lib/workspace-scope";
import { redirectToLoginAfterUnauthorized } from "@/lib/auth-navigation";
import { getCurrentDictionary } from "@/lib/i18n/locale-store";
import { getServerUrl } from "@/lib/server-url";

// Relative API paths are versioned here so feature code can call "/chats/..."
// or "chats/..." and still hit the public /api/v1 contract.
const API_VERSION_PREFIX = "/api/v1";
// The chat send endpoint only acknowledges a queued job, but other requests may
// still involve slow network conditions. One minute is the shared upper bound.
const REQUEST_TIMEOUT_MS = 60_000;

// The normalized error payload shape that UI code can inspect after any failed
// API request. It comes from the shared contract, not a hand-written frontend
// copy.
export type ApiErrorPayload = ApiErrorResponse["error"];
// Field-level validation errors use { field, messages[] }. Forms use this shape
// to show server-side validation messages next to individual inputs.
export type ApiValidationErrorDetail = {
	field: string;
	messages: string[];
};

// The one error class feature code should expect from the API layer. It carries
// HTTP status, request id, path, and server error code in first-class fields so
// callers do not need to understand axios's nested error object.
export class ApiClientError extends Error {
	readonly code: string;
	readonly details: ApiErrorPayload["details"];
	readonly hasServerEnvelopeMessage: boolean;
	readonly path: string;
	readonly requestId: string;
	readonly statusCode: number;
	readonly timestamp: string;

	constructor(
		error: ApiErrorPayload,
		options?: { cause?: unknown; hasServerEnvelopeMessage?: boolean },
	) {
		super(error.message, options);
		this.name = "ApiClientError";
		this.code = error.code;
		this.details = error.details;
		this.hasServerEnvelopeMessage = options?.hasServerEnvelopeMessage ?? false;
		this.path = error.path;
		this.requestId = error.requestId;
		this.statusCode = error.statusCode;
		this.timestamp = error.timestamp;
	}
}

// The shared axios instance used by the whole web app. withCredentials sends
// browser cookies along with requests, which is how better-auth sessions reach
// the NestJS API.
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

// Axios request interceptors run before every request leaves the browser. Here
// we standardize the URL and headers so feature services can stay very small.
BaseService.interceptors.request.use((config) => {
	config.url = normalizeApiPath(config.url);
	applyDefaultHeaders(config);

	return config;
});

// Axios response interceptors run after every response, including failures.
// Successful responses pass through untouched; failures become ApiClientError so
// UI code has one predictable error shape.
BaseService.interceptors.response.use(
	(response) => response,
	(error: unknown) => {
		const apiError = toApiClientError(error);
		dispatchBillingError(apiError);

		// A 401 usually means the session expired. Most calls should open the auth
		// flow, but some callers can opt out with skipAuthRedirect for custom UX.
		if (apiError.statusCode === 401 && shouldRedirectAfterUnauthorized(error)) {
			redirectToLoginAfterUnauthorized();
		}

		return Promise.reject(apiError);
	},
);

// Type guard used by UI and service code before reading ApiClientError fields.
export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}

// Convenience helper for auth-sensitive UI branches.
export function isUnauthorizedApiError(error: unknown) {
	return isApiClientError(error) && error.statusCode === 401;
}

// Convert any thrown value into a human-facing message. Prefer translated error
// codes over raw server text so users see localized copy when possible.
export function getApiErrorMessage(error: unknown) {
	if (isApiClientError(error)) {
		const codeMessage = getApiErrorCodeMessage(error.code);

		// Server codes such as "CHAT_BUSY" can map to localized copy in the current
		// dictionary. When that mapping exists, it wins.
		if (codeMessage) {
			return codeMessage;
		}

		// Only show the server's envelope message when we know it actually came from
		// the API. Client/network fallback messages are intentionally more generic.
		if (error.hasServerEnvelopeMessage && error.message) {
			return error.message;
		}

		return getGenericApiErrorMessage();
	}

	return getGenericApiErrorMessage();
}

// Pull the field-level validation detail list out of an ApiClientError. Unknown
// `details` shapes are ignored so malformed errors do not break forms.
export function getApiValidationErrors(error: unknown) {
	if (!isApiClientError(error) || !Array.isArray(error.details)) {
		return [];
	}

	return error.details.filter(isApiValidationErrorDetail);
}

// Find the first server-side validation message for one form field. If the
// message itself is a known error code, translate it before returning.
export function getApiFieldError(error: unknown, field: string) {
	const message = getApiValidationErrors(error).find(
		(detail) => detail.field === field,
	)?.messages[0];

	if (!message) {
		return undefined;
	}

	return getApiErrorCodeMessage(message) || message;
}

// Make sure Accept defaults to JSON even if a caller provided a custom headers
// object. AxiosHeaders normalizes casing so "accept" and "Accept" behave alike.
function applyDefaultHeaders(config: InternalAxiosRequestConfig) {
	const headers = AxiosHeaders.from(config.headers);

	if (!headers.get("Accept")) {
		headers.set("Accept", "application/json");
	}

	// Workspace scoping (teams-workspaces.md §2): every API request carries the
	// active workspace. Personal adds no header — requests stay byte-identical
	// to pre-teams clients.
	for (const [name, value] of Object.entries(workspaceScopeHeaders())) {
		headers.set(name, value);
	}

	config.headers = headers;
}

// Normalize relative API paths before axios joins them with baseURL. Absolute
// URLs are left alone so this client can still call a one-off external endpoint
// if a future feature needs that.
function normalizeApiPath(url: string | undefined) {
	if (!url || isAbsoluteUrl(url)) {
		return url;
	}

	const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

	// Shared route builders in @wandit/contracts already include /api/v1 today,
	// so this guard prevents double-prefixing those paths.
	if (normalizedUrl.startsWith("/api/")) {
		return normalizedUrl;
	}

	return `${API_VERSION_PREFIX}${normalizedUrl}`;
}

// Encode query params in the same way for every request. Arrays become repeated
// keys, and null/undefined values are skipped instead of serialized as text.
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

// Convert any thrown value from axios, app code, or an unknown source into
// ApiClientError. This is the main reason feature code does not have to branch
// on dozens of possible failure shapes.
function toApiClientError(error: unknown) {
	if (isApiClientError(error)) {
		return error;
	}

	if (axios.isAxiosError(error)) {
		const payload = error.response?.data;

		// Preferred case: the NestJS API sent the shared { error: ... } envelope, so
		// preserve its code/details/requestId/status exactly.
		if (isApiErrorResponse(payload)) {
			return new ApiClientError(payload.error, {
				cause: error,
				hasServerEnvelopeMessage: true,
			});
		}

		// Fallback for non-enveloped HTTP errors or network failures. statusCode 0
		// means no HTTP response came back at all.
		return new ApiClientError(
			{
				code: error.response
					? `HTTP_${error.response.status}`
					: "NETWORK_ERROR",
				message:
					error.response?.statusText ||
					error.message ||
					getNetworkApiErrorMessage(),
				path: buildErrorPath(error.config),
				requestId: readResponseHeader(error.response, "x-request-id"),
				statusCode: error.response?.status ?? 0,
				timestamp: new Date().toISOString(),
			},
			{ cause: error },
		);
	}

	// Client-side code can throw ordinary Error objects too, for example from a
	// parser or callback. Wrap them so the UI still receives ApiClientError.
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

	// Last-resort path for thrown strings, null, or any other unusual value.
	return new ApiClientError({
		code: "CLIENT_ERROR",
		message: getGenericApiErrorMessage(),
		path: "unknown",
		requestId: "unknown",
		statusCode: 0,
		timestamp: new Date().toISOString(),
	});
}

// Look up a localized message for an API error code in the currently active
// dictionary. Missing or non-string dictionary values are treated as not found.
function getApiErrorCodeMessage(code: string) {
	const codes = getCurrentDictionary().errors.codes as Record<string, unknown>;
	const message = Object.hasOwn(codes, code) ? codes[code] : undefined;
	return typeof message === "string" ? message : undefined;
}

// Generic fallback used when we cannot safely show a more specific API message.
function getGenericApiErrorMessage() {
	return getCurrentDictionary().errors.generic;
}

// Specific fallback for no-response/network failures.
function getNetworkApiErrorMessage() {
	return getCurrentDictionary().errors.network;
}

// Decide whether a 401 should trigger the global auth redirect. The custom
// skipAuthRedirect flag is carried on the axios request config by callers that
// want to handle unauthorized responses themselves.
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

// Runtime check for the shared error envelope. It only verifies the fields this
// file needs before constructing ApiClientError.
function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"error" in payload &&
		typeof (payload as ApiErrorResponse).error?.message === "string"
	);
}

// Runtime check for one field-validation detail. This keeps getApiValidationErrors
// from returning arbitrary unknown objects to forms.
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

// Build the path stored on fallback errors. Server envelopes already provide a
// path, but non-enveloped errors need one assembled from axios config.
function buildErrorPath(config: InternalAxiosRequestConfig | undefined) {
	if (!config?.url) {
		return "unknown";
	}

	if (isAbsoluteUrl(config.url)) {
		return config.url;
	}

	return `${config.baseURL ?? getServerUrl()}${config.url}`;
}

// Read a response header in a way that tolerates axios's string-or-array header
// values. The API uses x-request-id for support/debug correlation.
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

// Minimal absolute-URL check so normalizeApiPath knows when not to prefix.
function isAbsoluteUrl(value: string) {
	return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

// Default export for existing imports; api-service.ts imports this instance by
// default and builds the friendlier ApiService helpers on top of it.
export default BaseService;
