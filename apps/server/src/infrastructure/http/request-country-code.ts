type HeaderRecord = Record<string, string | string[] | undefined>;

export type RequestCountryHeaders =
	| globalThis.Headers
	| HeaderRecord
	| Iterable<readonly [string, string]>;

/**
 * Reads an ISO alpha-2 country from the trusted edge headers.
 *
 * This value is best-effort context, not security input. Vercel takes
 * precedence over Cloudflare, and XX/T1 are Cloudflare sentinel values.
 */
export function readRequestCountryCode(
	headers: RequestCountryHeaders | null | undefined,
): string | null {
	const vercel = readHeader(headers, "x-vercel-ip-country");
	const cloudflare = readHeader(headers, "cf-ipcountry");
	const raw = vercel ?? cloudflare;
	const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();

	if (!value || !/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") {
		return null;
	}

	return value;
}

function readHeader(
	headers: RequestCountryHeaders | null | undefined,
	name: string,
): string | string[] | null | undefined {
	if (!headers) {
		return null;
	}

	if ("get" in headers && typeof headers.get === "function") {
		return headers.get(name);
	}

	if (Symbol.iterator in headers) {
		for (const [key, value] of headers) {
			if (key.toLowerCase() === name) {
				return value;
			}
		}

		return null;
	}

	return headers[name];
}
