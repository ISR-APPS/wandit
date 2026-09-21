/**
 * Picks the Supabase region of a new backend from the user's country.
 * `BackendsService.provisionBackend` calls it at project creation with
 * the country code of the create request (WANDIT-175).
 * `SUPABASE_PLATFORM_REGION` overrides the result.
 */
import type { BackendRegion } from "./ports/backend-provider";

// D8 names Paris and Frankfurt; WANDIT-183 assigns central and northern
// Europe to Frankfurt. Every other code goes to Paris.
const FRANKFURT_COUNTRY_CODES = [
	"AT",
	"CH",
	"CZ",
	"DE",
	"DK",
	"FI",
	"NL",
	"NO",
	"PL",
	"SE",
] as const;

/**
 * `eu-central-1` for the listed ISO codes; `eu-west-3` for every other
 * code, for North Africa (`MA`, `DZ`, `TN`), for null, and for an unknown
 * code. The comparison is upper-case after a trim.
 */
export function pickSupabaseRegion(countryCode: string | null): BackendRegion {
	const normalized = countryCode?.trim().toUpperCase();
	if (FRANKFURT_COUNTRY_CODES.some((code) => code === normalized)) {
		return "eu-central-1";
	}
	return "eu-west-3";
}
