/**
 * The phishing name check (WANDIT-181). It finds a login, bank, or wallet
 * term in an app slug or a custom domain name. Look-alike letters do not hide
 * the term. The publish gate and the custom domain routes call
 * `findPhishingTerm`. Pure code, no IO.
 */
import { domainToUnicode } from "node:url";

// Short on purpose: each term blocks some honest names too (for example
// "banquet" holds "banque", "designing" holds "signin"). The domain error
// text sends the user to support for a false positive.
const PHISHING_TERMS = [
	// Login, bank, and wallet words in English, French, and Arabic.
	"login",
	"signin",
	"verify",
	"verification",
	"password",
	"wallet",
	"connexion",
	"portefeuille",
	"banque",
	"motdepasse",
	"تسجيل",
	"الدخول",
	"تحقق",
	"محفظة",
	// Short names of Algerian banks and payment services.
	"bna",
	"cpa",
	"bea",
	"badr",
	"bdl",
	"cnep",
	"baridimob",
	"edahabia",
	"algerieposte",
	"ccp",
	// Global brands that phishing pages copy.
	"paypal",
	"microsoft",
	"office365",
	"binance",
	"coinbase",
	"metamask",
] as const;

// Each key looks like its value in most fonts, or people type it in place of
// its value. The keys are escapes because most of them look the same as their
// value on screen.
const LOOK_ALIKE_LETTERS: Readonly<Record<string, string>> = {
	// Cyrillic
	"\u0430": "a",
	"\u0432": "b",
	"\u0433": "r",
	"\u0435": "e",
	"\u043a": "k",
	"\u043c": "m",
	"\u043d": "h",
	"\u043e": "o",
	"\u043f": "n",
	"\u0440": "p",
	"\u0441": "c",
	"\u0442": "t",
	"\u0443": "y",
	"\u0445": "x",
	"\u044c": "b",
	"\u0455": "s",
	"\u0456": "i",
	"\u0458": "j",
	"\u0461": "w",
	"\u0475": "v",
	"\u04af": "y",
	"\u04bb": "h",
	"\u04cf": "l",
	"\u0501": "d",
	"\u051b": "q",
	"\u051d": "w",
	// Greek
	"\u03b1": "a",
	"\u03b2": "b",
	"\u03b3": "y",
	"\u03b5": "e",
	"\u03b7": "n",
	"\u03b9": "i",
	"\u03ba": "k",
	"\u03bd": "v",
	"\u03bf": "o",
	"\u03c1": "p",
	"\u03c4": "t",
	"\u03c5": "u",
	"\u03c7": "x",
	"\u03c9": "w",
	// Latin letters that NFKD keeps, for example a letter with a stroke.
	"\u00f8": "o",
	"\u0111": "d",
	"\u0131": "i",
	"\u0142": "l",
	"\u0167": "t",
	"\u01c0": "l",
	"\u0251": "a",
	"\u0261": "g",
	"\u0269": "i",
	"\u026b": "l",
	// Arabic: the Farsi yeh looks the same as the Arabic yeh. People often
	// write the teh marbuta as a heh.
	"\u06cc": "\u064a",
	"\u0629": "\u0647",
	// Digits
	"0": "o",
	"1": "l",
	"3": "e",
	"4": "a",
	"5": "s",
	"7": "t",
	"8": "b",
	"9": "g",
};

// A term with fewer letters than this is a common letter group, so it
// matches only as a whole token.
const MIN_SUBSTRING_TERM_LENGTH = 4;

/**
 * Folds `text` into one look-alike form, then splits it into tokens of
 * letters and digits. The name and every term go through it.
 * `foldLetterPairs` also turns "rn" into "m" and "vv" into "w".
 */
function lookAlikeTokens(text: string, foldLetterPairs: boolean): string[] {
	// NFKD splits accents and wide forms. The Arabic tatweel only stretches a
	// word, so it goes with the accents.
	const plain = text
		.normalize("NFKD")
		.replace(/[\p{M}\u0640]/gu, "")
		.toLowerCase();
	const folded = Array.from(
		plain,
		(letter) => LOOK_ALIKE_LETTERS[letter] ?? letter,
	)
		.join("")
		// i, l, and 1 have one form, so "log1n" and "logln" both match "login".
		.replaceAll("i", "l");
	const paired = foldLetterPairs
		? folded.replaceAll("rn", "m").replaceAll("vv", "w")
		: folded;
	return paired.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0);
}

const LOOK_ALIKE_TERMS = PHISHING_TERMS.map((term) => {
	const form = lookAlikeTokens(term, true).join("");
	return {
		form,
		isWholeTokenOnly: [...form].length < MIN_SUBSTRING_TERM_LENGTH,
		term,
	};
});

/**
 * Returns the first phishing term that `name` holds, or null. `name` is an
 * app slug or a domain name. A domain drops its last label (the TLD), and
 * its punycode labels become Unicode first.
 */
export function findPhishingTerm(name: string): string | null {
	let text = name.toLowerCase();
	if (text.includes(".")) {
		const labels = text
			.split(".")
			// An invalid punycode label decodes to "". It keeps its ASCII form.
			.map((label) =>
				label.startsWith("xn--") ? domainToUnicode(label) || label : label,
			);
		text = labels.slice(0, -1).join(".");
	}
	// A pair fold across a term edge can hide the term ("badrnet" becomes
	// "badmet"). So the name also matches without the pair folds.
	const forms = [true, false].map((foldLetterPairs) => {
		const tokens = lookAlikeTokens(text, foldLetterPairs);
		// Joined, so a hyphen or a dot inside a term ("pay-pal") does not hide it.
		return { joined: tokens.join(""), tokens };
	});
	for (const { form, isWholeTokenOnly, term } of LOOK_ALIKE_TERMS) {
		const isFound = forms.some(({ joined, tokens }) =>
			isWholeTokenOnly ? tokens.includes(form) : joined.includes(form),
		);
		if (isFound) {
			return term;
		}
	}
	return null;
}
