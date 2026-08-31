import {
	DEFAULT_DIAL_COUNTRY_ISO,
	type DialCountry,
	type DialCountryIso,
	getDialCountry,
	onboardingPhonePattern,
	splitPhoneAnswer,
} from "@wandit/contracts";

export {
	countryCodeFromE164,
	DEFAULT_DIAL_COUNTRY_ISO,
	type DialCountry,
	type DialCountryIso,
	dialCountries,
	dialCountryIsoCodes,
	dialCountryIsoSchema,
	getDialCountry,
	isDialCountryIso,
	preferredCountryIsoByDial,
	splitPhoneAnswer,
} from "@wandit/contracts";

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

// Same folding as the server's normalize-lead-phone: Arabic-Indic (٠-٩) and
// Eastern Arabic-Indic (۰-۹) digits become ASCII so the ar locale can type
// naturally. (apps/server is not importable from the web bundle.)
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
 * Detects input typed or pasted in full international form — "+213 661…" or
 * "00213661…" — and returns its digits without the "+"/"00" prefix. Returns
 * undefined for plain national input.
 */
export function internationalDigitsOf(raw: string): string | undefined {
	const compact = foldArabicDigits(raw).replace(/[\s()./-]+/g, "");
	const digits = compact.startsWith("+")
		? compact.slice(1)
		: compact.startsWith("00")
			? compact.slice(2)
			: undefined;
	if (digits === undefined || !/^[0-9]*$/.test(digits)) return undefined;
	return digits;
}

/** Reduces raw national-number input to bare digits for E.164 composition. */
export function nationalDigitsOf(raw: string, country: DialCountry): string {
	const digits = foldArabicDigits(raw).replace(/[^0-9]/g, "");
	// Italy's leading zero is part of the international number.
	if (country.dial === "39") return digits;
	return digits.replace(/^0+/, "");
}

/** `+<dial><national digits>`, or "" while the national part is still empty. */
export function composePhoneAnswer(
	country: DialCountry,
	nationalRaw: string,
): string {
	const digits = nationalDigitsOf(nationalRaw, country);
	return digits ? `+${country.dial}${digits}` : "";
}

export function isCompletePhoneAnswer(value: string): boolean {
	return onboardingPhonePattern.test(value);
}

/** Restores the exact picker ISO when a calling code has several countries. */
export function restorePhoneAnswer(
	value: string,
	selectedCountryIso?: DialCountryIso,
): { country: DialCountry; national: string } | undefined {
	const selectedCountry = selectedCountryIso
		? getDialCountry(selectedCountryIso)
		: undefined;
	if (selectedCountry) {
		const prefix = `+${selectedCountry.dial}`;
		if (value === "" || value.startsWith(prefix)) {
			return {
				country: selectedCountry,
				national: value === "" ? "" : value.slice(prefix.length),
			};
		}
	}

	return splitPhoneAnswer(value);
}

/** Best-guess start country: the browser's region when we list it, else DZ. */
export function detectDialCountry(): DialCountry {
	const fallback = getDialCountry(DEFAULT_DIAL_COUNTRY_ISO);
	if (!fallback) throw new Error("Missing default dial country");
	if (typeof navigator === "undefined") return fallback;

	for (const tag of navigator.languages ?? [navigator.language]) {
		try {
			const region = new Intl.Locale(tag).maximize().region;
			const country = region && getDialCountry(region);
			if (country) return country;
		} catch {
			// Malformed language tags are ignorable — the fallback covers them.
		}
	}

	return fallback;
}

/** Localized country name via built-in ICU data; unknown codes echo back. */
export function dialCountryDisplayName(iso: string, locale: string): string {
	try {
		return new Intl.DisplayNames([locale], { type: "region" }).of(iso) ?? iso;
	} catch {
		return iso;
	}
}
