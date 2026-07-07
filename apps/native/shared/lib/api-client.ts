/**
 * api-client.ts — the public front door of the API layer.
 *
 * Feature request files import `apiClient` (and error helpers) from HERE, never
 * from base-service or api-service directly. Keeping one front door means we can
 * reshuffle the internals later without touching every feature.
 */
export {
	type ApiQueryParams,
	type ApiQueryValue,
	type ApiRequestOptions,
	ApiService,
	ApiService as apiClient,
} from "@/shared/lib/api-service";

export {
	ApiClientError,
	type ApiErrorPayload,
	getApiErrorMessage,
	isApiClientError,
	isUnauthorizedApiError,
} from "@/shared/lib/base-service";
