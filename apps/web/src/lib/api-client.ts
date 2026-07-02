// Public surface of the shared API client — the only door features use.
// BaseService (axios instance) sets base URL from env, sends cookies
// (better-auth), prefixes relative paths with /api/v1, unwraps the
// { data, meta } envelope and normalizes failures into ApiClientError;
// every feature's api/*.services.ts imports from here and parses responses
// with @wandit/contracts schemas. ISRECOM-26.
export {
	type ApiQueryParams,
	type ApiQueryValue,
	type ApiRequestOptions,
	ApiService,
	ApiService as apiClient,
} from "@/lib/api-service";
export {
	ApiClientError,
	type ApiErrorPayload,
	type ApiValidationErrorDetail,
	getApiErrorMessage,
	getApiFieldError,
	getApiValidationErrors,
	isApiClientError,
	isUnauthorizedApiError,
} from "@/lib/BaseService";
