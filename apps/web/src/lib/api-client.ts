/**
 * api-client.ts is the tiny public doorway into the web app's HTTP layer.
 *
 * In the AI chat flow, feature service files such as
 * features/workspace/api/chat.services.ts import `apiClient` from here, then call
 * the NestJS API's JSON endpoints for "find my chat", "load messages", and
 * "send this user message". The live assistant reply is different: it streams
 * over EventSource/SSE directly from use-project-chat.tsx, because streams do
 * not use the normal JSON response envelope.
 *
 * This file intentionally contains no logic of its own. It re-exports the safe
 * shared client from api-service.ts and the normalized error helpers from
 * BaseService.ts so feature code has one obvious import path.
 */
// Public surface of the shared API client — the only door features use.
// BaseService (axios instance) sets base URL from env, sends cookies
// (better-auth), prefixes relative paths with /api/v1, unwraps the
// { data, meta } envelope and normalizes failures into ApiClientError;
// every feature's api/*.services.ts imports from here and parses responses
// with @wandit/contracts schemas. ISRECOM-26.

// Re-export the high-level request helpers. `ApiService as apiClient` is the
// friendly name most feature files use so they do not need to know about axios.
export {
	type ApiQueryParams,
	type ApiQueryValue,
	type ApiRequestOptions,
	ApiService,
	ApiService as apiClient,
} from "@/lib/api-service";

// Re-export the normalized error type and helper functions so UI code can turn
// API failures into field errors, translated messages, or auth redirects without
// reaching into BaseService directly.
export {
	ApiClientError,
	type ApiErrorPayload,
	type ApiValidationErrorDetail,
	getApiErrorMessage,
	getApiFieldError,
	getApiValidationErrors,
	isApiClientError,
	isConnectivityApiError,
	isUnauthorizedApiError,
} from "@/lib/BaseService";
