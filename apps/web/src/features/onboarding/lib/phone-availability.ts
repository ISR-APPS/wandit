/**
 * Tells the onboarding page whether a failed request means the phone is taken.
 * Called by pages/onboarding-page.tsx after the complete request rejects.
 * Reads the ApiClientError fields through `isApiClientError` of @/lib/api-client.
 */
import { isApiClientError } from "@/lib/api-client";

/** True only for the API reply with code PHONE_ALREADY_TAKEN. Every other failure returns false. */
export function isPhoneTakenError(error: unknown): boolean {
	return isApiClientError(error) && error.code === "PHONE_ALREADY_TAKEN";
}
