import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";

const EARLY_ACCESS_REQUIRED_ERROR_CODE = "EARLY_ACCESS_REQUIRED";

export function getPublishErrorMessage(
	error: unknown,
	earlyAccessMessage: string,
): string {
	return isApiClientError(error) &&
		error.code === EARLY_ACCESS_REQUIRED_ERROR_CODE
		? earlyAccessMessage
		: getApiErrorMessage(error);
}
