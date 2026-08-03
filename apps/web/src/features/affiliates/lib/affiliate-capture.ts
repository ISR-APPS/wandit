import {
	AFFILIATE_SIGNUP_TOKEN_FIELD,
	affiliateClickResponseSchema,
	affiliatesRoutes,
} from "@wandit/contracts";

export const AFFILIATE_TOKEN_STORAGE_KEY = "wandit_affiliate_attribution_token";

type AffiliateFetchResponse = {
	json: () => Promise<unknown>;
	ok: boolean;
	status: number;
};

export type AffiliateFetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<AffiliateFetchResponse>;

export type AffiliateStorage = Pick<Storage, "getItem" | "setItem">;

export type AffiliateHistory = Pick<History, "replaceState" | "state">;

export type AffiliateLocation = Pick<Location, "href">;

export type AffiliateCaptureDependencies = {
	apiBaseUrl: string;
	fetch: AffiliateFetch;
	history: AffiliateHistory;
	location: AffiliateLocation;
	storage: AffiliateStorage;
};

export type AffiliateCaptureResult = {
	attributionToken: string;
	code: string;
	expiresAt: string;
};

/**
 * Creates one browser-location capture coordinator. The coordinator remembers
 * the original referral URL so React remounts or repeated route work cannot
 * post the same click twice while the request is in flight.
 */
export function createAffiliateCapture(
	dependencies: AffiliateCaptureDependencies,
) {
	const startedUrls = new Set<string>();

	return async function captureAffiliateFromLocation(): Promise<AffiliateCaptureResult | null> {
		const landingUrl = dependencies.location.href;
		const url = new URL(landingUrl);
		const hasReferral = url.searchParams.has("ref");
		const code = url.searchParams.get("ref")?.trim();

		if (!hasReferral) {
			return null;
		}

		if (!code) {
			stripReferralFromCurrentLocation(dependencies, "");
			return null;
		}

		if (startedUrls.has(landingUrl)) {
			return null;
		}

		startedUrls.add(landingUrl);

		try {
			const response = await dependencies.fetch(
				new URL(affiliatesRoutes.click, dependencies.apiBaseUrl),
				{
					body: JSON.stringify({ code, landingUrl }),
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					keepalive: true,
					method: "POST",
				},
			);

			if (!response.ok) {
				throw new Error(
					`Affiliate click capture failed with status ${response.status}`,
				);
			}

			const result = parseAffiliateClickPayload(await response.json());
			dependencies.storage.setItem(
				AFFILIATE_TOKEN_STORAGE_KEY,
				result.attributionToken,
			);
			stripReferralFromCurrentLocation(dependencies, code);

			return { ...result, code };
		} catch (error) {
			// Keep the referral in the address bar so a reload can retry a transient
			// failure. Concurrent calls remain coalesced while this request is active.
			startedUrls.delete(landingUrl);
			throw error;
		}
	};
}

function stripReferralFromCurrentLocation(
	dependencies: Pick<AffiliateCaptureDependencies, "history" | "location">,
	expectedCode: string,
) {
	const currentUrl = new URL(dependencies.location.href);
	if ((currentUrl.searchParams.get("ref")?.trim() ?? "") !== expectedCode) {
		return;
	}

	currentUrl.searchParams.delete("ref");
	dependencies.history.replaceState(
		dependencies.history.state,
		"",
		currentUrl.toString(),
	);
}

export function readStoredAffiliateToken(
	storage: Pick<Storage, "getItem">,
): string | undefined {
	const token = storage.getItem(AFFILIATE_TOKEN_STORAGE_KEY)?.trim();

	return token || undefined;
}

/** Better Auth does not infer arbitrary signup body fields. */
export function withAffiliateEmailSignupToken<TBody extends object>(
	body: TBody,
	storage: Pick<Storage, "getItem">,
): TBody & { affiliateToken?: string } {
	const token = readStoredAffiliateToken(storage);

	return {
		...body,
		...(token ? { [AFFILIATE_SIGNUP_TOKEN_FIELD]: token } : {}),
	};
}

/**
 * Applies the localStorage fallback at the shared Better Auth transport
 * boundary. This keeps future email-signup call sites covered without asking
 * each form to remember an untyped custom body field.
 */
export function withAffiliateTokenForAuthRequest(
	url: string | URL,
	body: unknown,
	storage: Pick<Storage, "getItem">,
): unknown {
	const pathname =
		url instanceof URL
			? url.pathname
			: new URL(url, "https://auth-client.invalid").pathname;

	if (!pathname.endsWith("/sign-up/email")) {
		return body;
	}

	const parsedBody = signupRequestBody(body);
	if (!parsedBody) {
		return body;
	}

	const attributedBody = withAffiliateEmailSignupToken(parsedBody, storage);
	return typeof body === "string"
		? JSON.stringify(attributedBody)
		: attributedBody;
}

function signupRequestBody(body: unknown): Record<string, unknown> | null {
	if (isRecord(body)) {
		return body;
	}

	if (typeof body !== "string") {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(body);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function parseAffiliateClickPayload(payload: unknown) {
	if (isRecord(payload) && "data" in payload) {
		return affiliateClickResponseSchema.parse(payload.data);
	}

	return affiliateClickResponseSchema.parse(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
