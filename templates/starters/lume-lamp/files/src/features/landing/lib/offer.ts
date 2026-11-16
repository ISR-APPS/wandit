// The sample offer of the page: price, edition size, reservation count, quantity cap, and the mail link.
// The hero, the reserve section, and the edition meter read it. Pure values and functions, no React.
// A real shop replaces these numbers with rows of a products table (see STARTER.md).

/** Launch price of one lamp, in whole US dollars. */
export const PRICE_USD = 249;

/** Regular price after the launch, in whole US dollars. The page shows it struck through. */
export const REGULAR_PRICE_USD = 289;

/** Count of lamps in the launch edition. Each lamp gets one number from 001 to this count. */
export const EDITION_SIZE = 250;

/** Lamps already reserved in the sample. The edition meter counts up to it. */
export const RESERVED_COUNT = 141;

/** Most lamps one household can reserve. The hint under the stepper gives the reason. */
export const MAX_QUANTITY = 2;

/** Address of the atelier. Fictional: the `.example` domain never receives mail. */
export const ATELIER_EMAIL = "atelier@lume.example";

/** A plain `mailto:` link to the atelier. The FAQ aside, the phone menu, and the footer use it. */
export const ATELIER_MAILTO = `mailto:${ATELIER_EMAIL}`;

const priceFormat = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

/** "$498" for 498. Whole dollars only, because every price of the page is a whole number. */
export function formatPrice(amountUsd: number) {
	return priceFormat.format(amountUsd);
}

/** The texts of the reservation mail, already translated by the caller. */
type ReservationMail = {
	/** Subject line, for example "Reservation — Orbe N°1, Crème × 1". */
	subject: string;
	/** One line per part of the body, joined with line breaks. */
	lines: string[];
};

/** A `mailto:` link to the atelier with the subject and the body filled in. */
export function reservationMailto({ subject, lines }: ReservationMail) {
	const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
	return `${ATELIER_MAILTO}?${query}`;
}

/** A `mailto:` link with a subject only, for the letter sign-up of the footer. */
export function subjectMailto(subject: string) {
	return `${ATELIER_MAILTO}?subject=${encodeURIComponent(subject)}`;
}
