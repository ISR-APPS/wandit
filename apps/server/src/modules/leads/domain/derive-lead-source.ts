/**
 * Derives the Leads tab's source label from captured ad attribution.
 *
 * Click ids are the strong signal (fbclid/ttclid are appended by the ad
 * platforms themselves); utm_source is the merchant-controlled fallback.
 * Anything unrecognized is "direct" — never a fourth bucket, the UI enum is
 * closed.
 */
import type { LeadSource } from "@wandit/contracts";

const FACEBOOK_UTM_SOURCES = new Set([
	"facebook",
	"fb",
	"instagram",
	"ig",
	"meta",
]);
const TIKTOK_UTM_SOURCES = new Set(["tiktok", "tt"]);

export function deriveLeadSource(attribution: unknown): LeadSource {
	if (typeof attribution !== "object" || attribution === null) {
		return "direct";
	}

	const record = attribution as Record<string, unknown>;
	if (typeof record.fbclid === "string" && record.fbclid.length > 0) {
		return "facebook";
	}
	if (typeof record.ttclid === "string" && record.ttclid.length > 0) {
		return "tiktok";
	}

	const utmSource =
		typeof record.utm_source === "string"
			? record.utm_source.trim().toLowerCase()
			: "";
	if (FACEBOOK_UTM_SOURCES.has(utmSource)) {
		return "facebook";
	}
	if (TIKTOK_UTM_SOURCES.has(utmSource)) {
		return "tiktok";
	}

	return "direct";
}
