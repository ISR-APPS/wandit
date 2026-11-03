/**
 * Normalizes raw form phone input into canonical E.164 (+213…, +964…).
 *
 * Buyers type phones every way imaginable: Arabic-Indic digits, spaces,
 * dashes, 0-prefixed local numbers, 00213 international dialing. The DB CHECK
 * (leads_phone_e164_ck) only admits the canonical form, so everything is
 * folded here at capture time. Returns null when the input cannot be a phone
 * number — the capture endpoint turns that into a validation error.
 * A national number takes the calling code of the page's market. Without one, it takes +213.
 */
import {
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";

// libphonenumber throws on a calling code it has no metadata for.
const SUPPORTED_CALLING_CODES: ReadonlySet<string> = new Set(
	getCountries().map((country) => getCountryCallingCode(country)),
);

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

// Practical E.164: leading +, no leading zero, 8–15 digits total. Matches the
// DB CHECK exactly — deliberately not Algeria-only, pages serve any market.
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

/** Folds Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII. */
export function foldArabicDigits(value: string): string {
	return value.replace(/[٠-٩۰-۹]/g, (digit) => {
		const code = digit.charCodeAt(0);
		const zero =
			code >= EXTENDED_ARABIC_INDIC_ZERO
				? EXTENDED_ARABIC_INDIC_ZERO
				: ARABIC_INDIC_ZERO;
		return String(code - zero);
	});
}

/**
 * True when the calling code (digits only, "964") has libphonenumber metadata.
 * The publish-time dial chip reader and the capture path both check it.
 */
export function isSupportedCallingCode(dialCode: string): boolean {
	return SUPPORTED_CALLING_CODES.has(dialCode);
}

/**
 * Returns E.164, or null when the input cannot be a phone number.
 * `dialCode` is the page market's calling code, digits only. The leads runtime sends it.
 */
export function normalizeLeadPhone(
	raw: string,
	dialCode?: string,
): string | null {
	// Separators people actually type: spaces, dots, dashes, parens, slashes.
	const cleaned = foldArabicDigits(raw).replace(/[\s()./-]+/g, "");

	if (!/^\+?[0-9]+$/.test(cleaned)) {
		return null;
	}

	let candidate: string | undefined;
	if (cleaned.startsWith("+")) {
		candidate = cleaned;
	} else if (cleaned.startsWith("00")) {
		candidate = `+${cleaned.slice(2)}`;
	} else if (dialCode && isSupportedCallingCode(dialCode)) {
		// The page shows its market prefix beside the field, so the visitor types a national number.
		// The trunk prefix differs by country: Iraq drops the 0, Côte d'Ivoire keeps it.
		const parsed = parsePhoneNumberFromString(cleaned, {
			defaultCallingCode: dialCode,
		});
		// isValid() alone rejects new number ranges and loses real leads. A possible length is
		// enough, unless libphonenumber kept a trunk 0 it could not strip ("05407731" is a typo).
		if (
			parsed &&
			(parsed.isValid() ||
				(parsed.isPossible() && !parsed.nationalNumber.startsWith("0")))
		) {
			candidate = parsed.number;
		}
	} else if (cleaned.startsWith("0") && cleaned.length >= 9) {
		// Local Algerian dialing: 05/06/07 mobiles and landlines alike. The
		// national number is 8-9 digits after the trunk 0 — shorter inputs must
		// not become "valid" 8-digit internationals by accident.
		candidate = `+213${cleaned.slice(1)}`;
	} else if (/^[567][0-9]{8}$/.test(cleaned)) {
		// Bare mobile without the trunk 0 (common when copying from WhatsApp).
		candidate = `+213${cleaned}`;
	}

	return candidate && E164_PATTERN.test(candidate) ? candidate : null;
}
