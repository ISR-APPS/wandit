/**
 * base-service.ts — the lowest shared HTTP layer for the mobile app.
 *
 * Everything that talks to the backend eventually comes through this one axios
 * instance. A feature calls apiClient → api-service.ts delegates here → this file
 * sends the real request to the NestJS API with the right base URL, session
 * cookie, /api/v1 prefix, and timeout.
 *
 * This is the native twin of the web app's BaseService.ts. There is ONE crucial
 * difference, and it is the heart of "connecting the phone to the backend":
 *
 *   WEB:  `withCredentials: true` — the browser attaches the session cookie
 *         automatically. No token code exists anywhere.
 *   PHONE: there is no browser and no automatic cookie. @better-auth/expo stores
 *         the session cookie in SecureStore and hands it back via
 *         authClient.getCookie(). We must set it BY HAND on every request (see
 *         attachSessionCookie below). That manual step is the whole difference.
 */
import type { ApiErrorResponse } from "@wandit/contracts";
import type { InternalAxiosRequestConfig } from "axios";
import axios, { AxiosHeaders } from "axios";

import { authClient } from "@/lib/auth-client";
import { redirectToSignIn } from "@/shared/lib/auth-redirect";
import { getServerUrl } from "@/shared/lib/server-url";

// Relative API paths are versioned here so feature code can call "/examples" and
// still hit the public /api/v1 contract.
const API_VERSION_PREFIX = "/api/v1";
// Upper bound for a single request. One minute matches the web client.
const REQUEST_TIMEOUT_MS = 60_000;

// Plain fallback messages. (Web localizes these via its i18n dictionary; on the
// phone we keep it simple for now — localize with @wandit/internationalization later.)
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE =
	"Network problem. Check your connection and try again.";

// The normalized error payload shape UI code can inspect after any failed
// request. It comes from the shared @wandit/contracts envelope, not a hand copy.
export type ApiErrorPayload = ApiErrorResponse["error"];

// The one error class feature code should expect from the API layer. It carries
// HTTP status, request id, path, and server error code as first-class fields so
// callers never have to dig through axios's nested error object.
export class ApiClientError extends Error {
	readonly code: string;
	readonly details: unknown;
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

// The shared axios instance used by the whole native app. Unlike web there is no
// `withCredentials` — the phone has no cookie jar, so the request interceptor
// below attaches the session cookie by hand instead.
export const BaseService = axios.create({
	baseURL: getServerUrl(),
	headers: {
		Accept: "application/json",
	},
	paramsSerializer: {
		serialize: serializeQueryParams,
	},
	timeout: REQUEST_TIMEOUT_MS,
});

// Request interceptors run before every request leaves the phone. We standardize
// the URL, attach the session cookie, and set default headers so feature code
// stays tiny.
BaseService.interceptors.request.use((config) => {
	config.url = normalizeApiPath(config.url);
	attachSessionCookie(config);
	applyDefaultHeaders(config);

	return config;
});

// Response interceptors run after every response, including failures. Successful
// responses pass through untouched; failures become ApiClientError so UI code has
// one predictable error shape.
BaseService.interceptors.response.use(
	(response) => response,
	(error: unknown) => {
		const apiError = toApiClientError(error);

		// A 401 usually means the session expired. Most calls should bounce to
		// sign-in, but a caller can opt out with skipAuthRedirect for custom UX.
		if (apiError.statusCode === 401 && shouldRedirectAfterUnauthorized(error)) {
			redirectToSignIn();
		}

		return Promise.reject(apiError);
	},
);

// Type guard used by UI and service code before reading ApiClientError fields.
export function isApiClientError(error: unknown): error is ApiClientError {
	return error instanceof ApiClientError;
}

// Convenience helper for auth-sensitive branches (also used by query-client.ts to
// avoid retrying a request that failed because the session is gone).
export function isUnauthorizedApiError(error: unknown) {
	return isApiClientError(error) && error.statusCode === 401;
}

// Turn any thrown value into a short, human-facing message for toasts/inline UI.
export function getApiErrorMessage(error: unknown) {
	if (isApiClientError(error)) {
		if (error.code === "NETWORK_ERROR") {
			return NETWORK_ERROR_MESSAGE;
		}

		// Only trust the server's message when we know it came from the API envelope.
		if (error.hasServerEnvelopeMessage && error.message) {
			return error.message;
		}
	}

	return GENERIC_ERROR_MESSAGE;
}

// THE key native step: read the session cookie @better-auth/expo stored in
// SecureStore and attach it to this request. This is what web gets for free via
// `withCredentials: true`.
function attachSessionCookie(config: InternalAxiosRequestConfig) {
	const cookie = authClient.getCookie();

	if (cookie) {
		const headers = AxiosHeaders.from(config.headers);
		headers.set("Cookie", cookie);
		config.headers = headers;
	}
}

// Make sure Accept defaults to JSON even if a caller passed a custom headers
// object. AxiosHeaders normalizes casing so "accept" and "Accept" behave alike.
function applyDefaultHeaders(config: InternalAxiosRequestConfig) {
	const headers = AxiosHeaders.from(config.headers);

	if (!headers.get("Accept")) {
		headers.set("Accept", "application/json");
	}

	config.headers = headers;
}

// Normalize relative API paths before axios joins them with baseURL. Absolute
// URLs are left alone so this client can still hit a one-off external endpoint.
function normalizeApiPath(url: string | undefined) {
	if (!url || isAbsoluteUrl(url)) {
		return url;
	}

	const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

	// Route builders in @wandit/contracts already include /api/v1, so this guard
	// prevents double-prefixing those paths.
	if (normalizedUrl.startsWith("/api/")) {
		return normalizedUrl;
	}

	return `${API_VERSION_PREFIX}${normalizedUrl}`;
}

// Encode query params the same way for every request. Arrays become repeated
// keys, and null/undefined values are skipped. Written by hand (no URLSearchParams)
// because React Native's URLSearchParams is not fully reliable across engines.
function serializeQueryParams(params: Record<string, unknown>) {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(params)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== null && item !== undefined) {
				parts.push(
					`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
				);
			}
		}
	}

	return parts.join("&");
}

// Convert any thrown value from axios, app code, or an unknown source into
// ApiClientError. This is why feature code never has to branch on dozens of
// possible failure shapes.
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
					error.response?.statusText || error.message || NETWORK_ERROR_MESSAGE,
				path: error.config?.url ?? "unknown",
				requestId: "unknown",
				statusCode: error.response?.status ?? 0,
				timestamp: new Date().toISOString(),
			},
			{ cause: error },
		);
	}

	// Client-side code can throw ordinary Error objects too (e.g. a Zod parse).
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
		message: GENERIC_ERROR_MESSAGE,
		path: "unknown",
		requestId: "unknown",
		statusCode: 0,
		timestamp: new Date().toISOString(),
	});
}

// Decide whether a 401 should trigger the global sign-in redirect. Callers set
// skipAuthRedirect on the request options when they want to handle 401 themselves.
function shouldRedirectAfterUnauthorized(error: unknown) {
	if (!axios.isAxiosError(error)) {
		return true;
	}

	return !(
		error.config as
			| (InternalAxiosRequestConfig & { skipAuthRedirect?: boolean })
			| null
	)?.skipAuthRedirect;
}

// Runtime check for the shared error envelope. Only verifies the fields this file
// needs before constructing ApiClientError.
function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"error" in payload &&
		typeof (payload as ApiErrorResponse).error?.message === "string"
	);
}

// Minimal absolute-URL check so normalizeApiPath knows when not to prefix.
function isAbsoluteUrl(value: string) {
	return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

// Default export for symmetry with web; api-service.ts imports this instance.
export default BaseService;
