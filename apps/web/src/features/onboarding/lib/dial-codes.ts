import { onboardingPhonePattern } from "@wandit/contracts";

/**
 * Country calling codes for the onboarding phone step. The answer is stored
 * as one E.164 string (`+213661223344`), so the picked country never leaves
 * the client — it only seeds the dial-code prefix.
 *
 * Dial codes are kept digits-only; the UI renders the `+`. Country names are
 * not stored here: `Intl.DisplayNames` localizes them at render time (same
 * approach as the server's google-maps-search countryNameOf).
 */

export type DialCountry = {
	/** ISO 3166-1 alpha-2, upper case. */
	iso: string;
	/** Country calling code without the leading `+`. */
	dial: string;
};

// Market default, aligned with DEFAULT_REGISTRANT_COUNTRY (features/domains)
// and the server's normalize-lead-phone fallback.
export const DEFAULT_DIAL_COUNTRY_ISO = "DZ";

export const dialCountries: readonly DialCountry[] = [
	{ iso: "AD", dial: "376" },
	{ iso: "AE", dial: "971" },
	{ iso: "AF", dial: "93" },
	{ iso: "AG", dial: "1" },
	{ iso: "AI", dial: "1" },
	{ iso: "AL", dial: "355" },
	{ iso: "AM", dial: "374" },
	{ iso: "AO", dial: "244" },
	{ iso: "AR", dial: "54" },
	{ iso: "AS", dial: "1" },
	{ iso: "AT", dial: "43" },
	{ iso: "AU", dial: "61" },
	{ iso: "AW", dial: "297" },
	{ iso: "AX", dial: "358" },
	{ iso: "AZ", dial: "994" },
	{ iso: "BA", dial: "387" },
	{ iso: "BB", dial: "1" },
	{ iso: "BD", dial: "880" },
	{ iso: "BE", dial: "32" },
	{ iso: "BF", dial: "226" },
	{ iso: "BG", dial: "359" },
	{ iso: "BH", dial: "973" },
	{ iso: "BI", dial: "257" },
	{ iso: "BJ", dial: "229" },
	{ iso: "BL", dial: "590" },
	{ iso: "BM", dial: "1" },
	{ iso: "BN", dial: "673" },
	{ iso: "BO", dial: "591" },
	{ iso: "BQ", dial: "599" },
	{ iso: "BR", dial: "55" },
	{ iso: "BS", dial: "1" },
	{ iso: "BT", dial: "975" },
	{ iso: "BW", dial: "267" },
	{ iso: "BY", dial: "375" },
	{ iso: "BZ", dial: "501" },
	{ iso: "CA", dial: "1" },
	{ iso: "CC", dial: "61" },
	{ iso: "CD", dial: "243" },
	{ iso: "CF", dial: "236" },
	{ iso: "CG", dial: "242" },
	{ iso: "CH", dial: "41" },
	{ iso: "CI", dial: "225" },
	{ iso: "CK", dial: "682" },
	{ iso: "CL", dial: "56" },
	{ iso: "CM", dial: "237" },
	{ iso: "CN", dial: "86" },
	{ iso: "CO", dial: "57" },
	{ iso: "CR", dial: "506" },
	{ iso: "CU", dial: "53" },
	{ iso: "CV", dial: "238" },
	{ iso: "CW", dial: "599" },
	{ iso: "CX", dial: "61" },
	{ iso: "CY", dial: "357" },
	{ iso: "CZ", dial: "420" },
	{ iso: "DE", dial: "49" },
	{ iso: "DJ", dial: "253" },
	{ iso: "DK", dial: "45" },
	{ iso: "DM", dial: "1" },
	{ iso: "DO", dial: "1" },
	{ iso: "DZ", dial: "213" },
	{ iso: "EC", dial: "593" },
	{ iso: "EE", dial: "372" },
	{ iso: "EG", dial: "20" },
	{ iso: "EH", dial: "212" },
	{ iso: "ER", dial: "291" },
	{ iso: "ES", dial: "34" },
	{ iso: "ET", dial: "251" },
	{ iso: "FI", dial: "358" },
	{ iso: "FJ", dial: "679" },
	{ iso: "FK", dial: "500" },
	{ iso: "FM", dial: "691" },
	{ iso: "FO", dial: "298" },
	{ iso: "FR", dial: "33" },
	{ iso: "GA", dial: "241" },
	{ iso: "GB", dial: "44" },
	{ iso: "GD", dial: "1" },
	{ iso: "GE", dial: "995" },
	{ iso: "GF", dial: "594" },
	{ iso: "GG", dial: "44" },
	{ iso: "GH", dial: "233" },
	{ iso: "GI", dial: "350" },
	{ iso: "GL", dial: "299" },
	{ iso: "GM", dial: "220" },
	{ iso: "GN", dial: "224" },
	{ iso: "GP", dial: "590" },
	{ iso: "GQ", dial: "240" },
	{ iso: "GR", dial: "30" },
	{ iso: "GT", dial: "502" },
	{ iso: "GU", dial: "1" },
	{ iso: "GW", dial: "245" },
	{ iso: "GY", dial: "592" },
	{ iso: "HK", dial: "852" },
	{ iso: "HN", dial: "504" },
	{ iso: "HR", dial: "385" },
	{ iso: "HT", dial: "509" },
	{ iso: "HU", dial: "36" },
	{ iso: "ID", dial: "62" },
	{ iso: "IE", dial: "353" },
	{ iso: "IL", dial: "972" },
	{ iso: "IM", dial: "44" },
	{ iso: "IN", dial: "91" },
	{ iso: "IO", dial: "246" },
	{ iso: "IQ", dial: "964" },
	{ iso: "IR", dial: "98" },
	{ iso: "IS", dial: "354" },
	{ iso: "IT", dial: "39" },
	{ iso: "JE", dial: "44" },
	{ iso: "JM", dial: "1" },
	{ iso: "JO", dial: "962" },
	{ iso: "JP", dial: "81" },
	{ iso: "KE", dial: "254" },
	{ iso: "KG", dial: "996" },
	{ iso: "KH", dial: "855" },
	{ iso: "KI", dial: "686" },
	{ iso: "KM", dial: "269" },
	{ iso: "KN", dial: "1" },
	{ iso: "KP", dial: "850" },
	{ iso: "KR", dial: "82" },
	{ iso: "KW", dial: "965" },
	{ iso: "KY", dial: "1" },
	{ iso: "KZ", dial: "7" },
	{ iso: "LA", dial: "856" },
	{ iso: "LB", dial: "961" },
	{ iso: "LC", dial: "1" },
	{ iso: "LI", dial: "423" },
	{ iso: "LK", dial: "94" },
	{ iso: "LR", dial: "231" },
	{ iso: "LS", dial: "266" },
	{ iso: "LT", dial: "370" },
	{ iso: "LU", dial: "352" },
	{ iso: "LV", dial: "371" },
	{ iso: "LY", dial: "218" },
	{ iso: "MA", dial: "212" },
	{ iso: "MC", dial: "377" },
	{ iso: "MD", dial: "373" },
	{ iso: "ME", dial: "382" },
	{ iso: "MF", dial: "590" },
	{ iso: "MG", dial: "261" },
	{ iso: "MH", dial: "692" },
	{ iso: "MK", dial: "389" },
	{ iso: "ML", dial: "223" },
	{ iso: "MM", dial: "95" },
	{ iso: "MN", dial: "976" },
	{ iso: "MO", dial: "853" },
	{ iso: "MP", dial: "1" },
	{ iso: "MQ", dial: "596" },
	{ iso: "MR", dial: "222" },
	{ iso: "MS", dial: "1" },
	{ iso: "MT", dial: "356" },
	{ iso: "MU", dial: "230" },
	{ iso: "MV", dial: "960" },
	{ iso: "MW", dial: "265" },
	{ iso: "MX", dial: "52" },
	{ iso: "MY", dial: "60" },
	{ iso: "MZ", dial: "258" },
	{ iso: "NA", dial: "264" },
	{ iso: "NC", dial: "687" },
	{ iso: "NE", dial: "227" },
	{ iso: "NF", dial: "672" },
	{ iso: "NG", dial: "234" },
	{ iso: "NI", dial: "505" },
	{ iso: "NL", dial: "31" },
	{ iso: "NO", dial: "47" },
	{ iso: "NP", dial: "977" },
	{ iso: "NR", dial: "674" },
	{ iso: "NU", dial: "683" },
	{ iso: "NZ", dial: "64" },
	{ iso: "OM", dial: "968" },
	{ iso: "PA", dial: "507" },
	{ iso: "PE", dial: "51" },
	{ iso: "PF", dial: "689" },
	{ iso: "PG", dial: "675" },
	{ iso: "PH", dial: "63" },
	{ iso: "PK", dial: "92" },
	{ iso: "PL", dial: "48" },
	{ iso: "PM", dial: "508" },
	{ iso: "PR", dial: "1" },
	{ iso: "PS", dial: "970" },
	{ iso: "PT", dial: "351" },
	{ iso: "PW", dial: "680" },
	{ iso: "PY", dial: "595" },
	{ iso: "QA", dial: "974" },
	{ iso: "RE", dial: "262" },
	{ iso: "RO", dial: "40" },
	{ iso: "RS", dial: "381" },
	{ iso: "RU", dial: "7" },
	{ iso: "RW", dial: "250" },
	{ iso: "SA", dial: "966" },
	{ iso: "SB", dial: "677" },
	{ iso: "SC", dial: "248" },
	{ iso: "SD", dial: "249" },
	{ iso: "SE", dial: "46" },
	{ iso: "SG", dial: "65" },
	{ iso: "SH", dial: "290" },
	{ iso: "SI", dial: "386" },
	{ iso: "SJ", dial: "47" },
	{ iso: "SK", dial: "421" },
	{ iso: "SL", dial: "232" },
	{ iso: "SM", dial: "378" },
	{ iso: "SN", dial: "221" },
	{ iso: "SO", dial: "252" },
	{ iso: "SR", dial: "597" },
	{ iso: "SS", dial: "211" },
	{ iso: "ST", dial: "239" },
	{ iso: "SV", dial: "503" },
	{ iso: "SX", dial: "1" },
	{ iso: "SY", dial: "963" },
	{ iso: "SZ", dial: "268" },
	{ iso: "TC", dial: "1" },
	{ iso: "TD", dial: "235" },
	{ iso: "TG", dial: "228" },
	{ iso: "TH", dial: "66" },
	{ iso: "TJ", dial: "992" },
	{ iso: "TK", dial: "690" },
	{ iso: "TL", dial: "670" },
	{ iso: "TM", dial: "993" },
	{ iso: "TN", dial: "216" },
	{ iso: "TO", dial: "676" },
	{ iso: "TR", dial: "90" },
	{ iso: "TT", dial: "1" },
	{ iso: "TV", dial: "688" },
	{ iso: "TW", dial: "886" },
	{ iso: "TZ", dial: "255" },
	{ iso: "UA", dial: "380" },
	{ iso: "UG", dial: "256" },
	{ iso: "US", dial: "1" },
	{ iso: "UY", dial: "598" },
	{ iso: "UZ", dial: "998" },
	{ iso: "VA", dial: "39" },
	{ iso: "VC", dial: "1" },
	{ iso: "VE", dial: "58" },
	{ iso: "VG", dial: "1" },
	{ iso: "VI", dial: "1" },
	{ iso: "VN", dial: "84" },
	{ iso: "VU", dial: "678" },
	{ iso: "WF", dial: "681" },
	{ iso: "WS", dial: "685" },
	{ iso: "XK", dial: "383" },
	{ iso: "YE", dial: "967" },
	{ iso: "YT", dial: "262" },
	{ iso: "ZA", dial: "27" },
	{ iso: "ZM", dial: "260" },
	{ iso: "ZW", dial: "263" },
];

// Several countries share one calling code (all of NANP is "1"). When a
// stored answer is split back into country + national number, the shared
// code alone cannot name the country — these are the conventional owners.
const SHARED_DIAL_OWNER: Record<string, string> = {
	"1": "US",
	"7": "RU",
	"39": "IT",
	"44": "GB",
	"47": "NO",
	"61": "AU",
	"212": "MA",
	"262": "RE",
	"358": "FI",
	"590": "GP",
	"599": "CW",
};

const dialCountryByIso = new Map(
	dialCountries.map((country) => [country.iso, country]),
);

export function getDialCountry(iso: string): DialCountry | undefined {
	return dialCountryByIso.get(iso);
}

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
 * undefined for plain national input. Same prefixes as the server's
 * normalize-lead-phone; without this, a pasted own number would get the
 * picked dial code prepended a second time.
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

/**
 * Reduces raw national-number input to bare digits. The trunk "0" people
 * habitually type (06 61… in Algeria and France) is not part of E.164, so
 * leading zeros are dropped — except for Italy (+39), where the leading zero
 * genuinely belongs to the number.
 */
export function nationalDigitsOf(raw: string, country: DialCountry): string {
	const digits = foldArabicDigits(raw).replace(/[^0-9]/g, "");
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

/**
 * Splits a stored answer back into country + national number so the step can
 * restore itself when the user navigates back. Longest dial-code prefix wins;
 * shared codes resolve to their conventional owner.
 */
export function splitPhoneAnswer(
	value: string,
): { country: DialCountry; national: string } | undefined {
	if (!value.startsWith("+")) return undefined;
	const digits = value.slice(1);

	let match: DialCountry | undefined;
	for (const country of dialCountries) {
		if (!digits.startsWith(country.dial)) continue;
		if (!match || country.dial.length > match.dial.length) {
			match = country;
			continue;
		}
		if (
			country.dial.length === match.dial.length &&
			SHARED_DIAL_OWNER[country.dial] === country.iso
		) {
			match = country;
		}
	}

	if (!match) return undefined;
	return { country: match, national: digits.slice(match.dial.length) };
}

/** Best-guess start country: the browser's region when we list it, else DZ. */
export function detectDialCountry(): DialCountry {
	const fallback = dialCountryByIso.get(DEFAULT_DIAL_COUNTRY_ISO);
	if (!fallback) throw new Error("Missing default dial country");
	if (typeof navigator === "undefined") return fallback;

	for (const tag of navigator.languages ?? [navigator.language]) {
		try {
			const region = new Intl.Locale(tag).maximize().region;
			const country = region && dialCountryByIso.get(region);
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
