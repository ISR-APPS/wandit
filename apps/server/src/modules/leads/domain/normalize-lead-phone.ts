/**
 * Normalizes raw form phone input into canonical E.164 (+213…).
 *
 * Buyers type phones every way imaginable: Arabic-Indic digits, spaces,
 * dashes, 0-prefixed local numbers, 00213 international dialing. The DB CHECK
 * (leads_phone_e164_ck) only admits the canonical form, so everything is
 * folded here at capture time. Returns null when the input cannot be a phone
 * number — the capture endpoint turns that into a validation error.
 */

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

export function normalizeLeadPhone(raw: string): string | null {
	// Separators people actually type: spaces, dots, dashes, parens, slashes.
	const cleaned = foldArabicDigits(raw).replace(/[\s()./-]+/g, "");

	if (!/^\+?[0-9]+$/.test(cleaned)) {
		return null;
	}

	let candidate: string;
	if (cleaned.startsWith("+")) {
		candidate = cleaned;
	} else if (cleaned.startsWith("00")) {
		candidate = `+${cleaned.slice(2)}`;
	} else if (cleaned.startsWith("0") && cleaned.length >= 9) {
		// Local Algerian dialing: 05/06/07 mobiles and landlines alike. The
		// national number is 8-9 digits after the trunk 0 — shorter inputs must
		// not become "valid" 8-digit internationals by accident.
		candidate = `+213${cleaned.slice(1)}`;
	} else if (/^[567][0-9]{8}$/.test(cleaned)) {
		// Bare mobile without the trunk 0 (common when copying from WhatsApp).
		candidate = `+213${cleaned}`;
	} else {
		return null;
	}

	return E164_PATTERN.test(candidate) ? candidate : null;
}
