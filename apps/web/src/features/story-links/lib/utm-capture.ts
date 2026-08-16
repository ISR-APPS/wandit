import { attributionRoutes, type UtmAttributionBody } from "@wandit/contracts";

export const UTM_LAST_TOUCH_STORAGE_KEY = "wandit_utm_last_touch";
export const REFERRER_ATTRIBUTION_SENT_STORAGE_KEY =
	"wandit_ref_attribution_sent";

const UTM_PARAMETER_PREFIX = "utm_";

type UtmAttributionFetchResponse = {
	ok: boolean;
	status: number;
};

export type UtmAttributionFetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<UtmAttributionFetchResponse>;

export type UtmLastTouch = {
	utmSource: string | null;
	utmMedium: string | null;
	utmCampaign: string | null;
	utmContent: string | null;
	landingPath: string;
	at: string;
};

export type UtmCaptureDependencies = {
	apiBaseUrl: string;
	fetch: UtmAttributionFetch;
	history: Pick<History, "replaceState" | "state">;
	location: Pick<Location, "href">;
	now: () => Date;
	referrer: string;
	sessionStorage: Pick<Storage, "getItem" | "setItem">;
	storage: Pick<Storage, "setItem">;
};

/** Creates a browser-location coordinator for last-touch UTM attribution. */
export function createUtmCapture(dependencies: UtmCaptureDependencies) {
	let utmLandingCaptured = false;

	return function captureUtmFromLocation(): UtmLastTouch | null {
		if (utmLandingCaptured) {
			return null;
		}

		const url = new URL(dependencies.location.href);
		const utmParameterNames = getUtmParameterNames(url);
		const externalReferrer = getExternalReferrer(url, dependencies.referrer);

		if (utmParameterNames.length === 0) {
			captureExternalReferrer(dependencies, url.pathname, externalReferrer);
			return null;
		}

		const lastTouch: UtmLastTouch = {
			utmSource: url.searchParams.get("utm_source"),
			utmMedium: url.searchParams.get("utm_medium"),
			utmCampaign: url.searchParams.get("utm_campaign"),
			utmContent: url.searchParams.get("utm_content"),
			landingPath: url.pathname,
			at: dependencies.now().toISOString(),
		};

		dependencies.storage.setItem(
			UTM_LAST_TOUCH_STORAGE_KEY,
			JSON.stringify(lastTouch),
		);

		for (const parameterName of utmParameterNames) {
			url.searchParams.delete(parameterName);
		}

		dependencies.history.replaceState(
			dependencies.history.state,
			"",
			url.toString(),
		);
		utmLandingCaptured = true;

		const attributionBody = createUtmAttributionBody(
			lastTouch,
			externalReferrer,
		);
		if (attributionBody) {
			postAttributionBestEffort(dependencies, attributionBody);
		}

		return lastTouch;
	};
}

function captureExternalReferrer(
	dependencies: UtmCaptureDependencies,
	landingPath: string,
	referrer: string | undefined,
) {
	if (
		!referrer ||
		dependencies.sessionStorage.getItem(
			REFERRER_ATTRIBUTION_SENT_STORAGE_KEY,
		) !== null
	) {
		return;
	}

	dependencies.sessionStorage.setItem(
		REFERRER_ATTRIBUTION_SENT_STORAGE_KEY,
		"1",
	);
	postAttributionBestEffort(dependencies, { landingPath, referrer });
}

function createUtmAttributionBody(
	lastTouch: UtmLastTouch,
	referrer: string | undefined,
): UtmAttributionBody | null {
	const utmSource = nonEmptyValue(lastTouch.utmSource);
	const utmMedium = nonEmptyValue(lastTouch.utmMedium);
	const utmCampaign = nonEmptyValue(lastTouch.utmCampaign);
	const utmContent = nonEmptyValue(lastTouch.utmContent);

	if (!utmSource && !referrer) {
		return null;
	}

	return {
		landingPath: lastTouch.landingPath,
		...(utmSource ? { utmSource } : {}),
		...(utmMedium ? { utmMedium } : {}),
		...(utmCampaign ? { utmCampaign } : {}),
		...(utmContent ? { utmContent } : {}),
		...(referrer ? { referrer } : {}),
	};
}

function nonEmptyValue(value: string | null) {
	return value?.trim() || undefined;
}

function getExternalReferrer(landingUrl: URL, referrer: string) {
	const normalizedReferrer = referrer.trim();
	if (!normalizedReferrer) {
		return undefined;
	}

	try {
		const referrerUrl = new URL(normalizedReferrer, landingUrl);
		return referrerUrl.origin === landingUrl.origin
			? undefined
			: normalizedReferrer;
	} catch {
		return undefined;
	}
}

function postAttributionBestEffort(
	dependencies: Pick<UtmCaptureDependencies, "apiBaseUrl" | "fetch">,
	body: UtmAttributionBody,
) {
	void postAttribution(dependencies, body).catch(() => {
		// Attribution is best-effort. The local UTM stash and URL cleanup remain
		// authoritative fallbacks when the API is unavailable.
	});
}

async function postAttribution(
	dependencies: Pick<UtmCaptureDependencies, "apiBaseUrl" | "fetch">,
	body: UtmAttributionBody,
) {
	const response = await dependencies.fetch(
		new URL(attributionRoutes.captureUtm, dependencies.apiBaseUrl),
		{
			body: JSON.stringify(body),
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			keepalive: true,
			method: "POST",
		},
	);

	if (!response.ok) {
		throw new Error(
			`UTM attribution capture failed with status ${response.status}`,
		);
	}
}

function getUtmParameterNames(url: URL) {
	return [...new Set(url.searchParams.keys())].filter((parameterName) =>
		parameterName.startsWith(UTM_PARAMETER_PREFIX),
	);
}
