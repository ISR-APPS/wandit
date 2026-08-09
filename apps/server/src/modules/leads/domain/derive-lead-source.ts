/**
 * Derives the Leads tab's source label from captured ad attribution.
 *
 * Click ids are the strong signal (fbclid/ttclid are appended by the ad
 * platforms themselves); utm_source is the merchant-controlled fallback.
 * Anything unrecognized is "direct" — never a fourth bucket, the UI enum is
 * closed.
 */
import type { LeadSource } from "@wandit/contracts";

// Exported so the leads repository's SQL source filter can be built from the
// same lists — the derivation must behave identically in JS and in SQL.
export const FACEBOOK_UTM_SOURCES = [
	"facebook",
	"fb",
	"instagram",
	"ig",
	"meta",
] as const;
export const TIKTOK_UTM_SOURCES = ["tiktok", "tt"] as const;

const FACEBOOK_UTM_SOURCE_SET = new Set<string>(FACEBOOK_UTM_SOURCES);
const TIKTOK_UTM_SOURCE_SET = new Set<string>(TIKTOK_UTM_SOURCES);

/** Campaign name cap on the wire — matches the capture-side utm limit. */
const MAX_CAMPAIGN_LENGTH = 200;

/**
 * The human campaign label for one lead: utm_campaign as the merchant (or
 * the agent's UTM tagging) wrote it, trimmed and capped. Null when the ad
 * link carried no utm_campaign — click ids alone cannot name a campaign.
 */
export function deriveLeadCampaign(attribution: unknown): string | null {
	if (typeof attribution !== "object" || attribution === null) {
		return null;
	}

	const campaign = (attribution as Record<string, unknown>).utm_campaign;
	if (typeof campaign !== "string") {
		return null;
	}

	const trimmed = campaign.trim().slice(0, MAX_CAMPAIGN_LENGTH);

	return trimmed.length > 0 ? trimmed : null;
}

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
	if (FACEBOOK_UTM_SOURCE_SET.has(utmSource)) {
		return "facebook";
	}
	if (TIKTOK_UTM_SOURCE_SET.has(utmSource)) {
		return "tiktok";
	}

	return "direct";
}
