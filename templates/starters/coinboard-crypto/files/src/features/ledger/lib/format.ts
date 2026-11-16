// Number and text formats of the app: money, unit prices, quantities, percents, and message templates.
// The pages and the cards of every feature call them. They use only Intl and string methods.

/** ISO 4217 code of every price and amount in the sample ledger. A later database gives the currency of the user. */
export const CURRENCY = "USD";

/**
 * A money format for totals. "standard" shows cents: $186,420.37. "compact" shows three digits and a unit: $186K.
 * Tables and figures use standard. Chart axes and market sizes use compact.
 */
export function moneyFormat(
	locale: string,
	notation: "standard" | "compact" = "standard",
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		...(notation === "compact"
			? { notation: "compact", maximumSignificantDigits: 3 }
			: { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
	});
}

/**
 * A signed money format for a gain or a loss: +$1,240.55, -$310.02. Zero has no sign.
 * `fractionDigits` 0 drops the cents for a narrow tile: +$1,241.
 */
export function signedMoneyFormat(
	locale: string,
	fractionDigits: 0 | 2 = 2,
): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		signDisplay: "exceptZero",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}

/** The count of decimals that a unit price needs: 2 from $2, 4 under $2, 5 under one cent. */
export function priceDecimals(price: number): number {
	// A stablecoin near $1 moves in its third and fourth decimal, so $2 is the limit, not $1.
	if (price >= 2) {
		return 2;
	}
	return price >= 0.01 ? 4 : 5;
}

/** The unit price of one asset as text. A cheap asset keeps enough decimals to show a change. */
export function formatPrice(price: number, locale: string): string {
	const decimals = priceDecimals(price);
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: CURRENCY,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(price);
}

/** A count of asset units as text, with at most 4 decimals: 1.6204, 14,800, 0.25. */
export function formatQuantity(quantity: number, locale: string): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
		quantity,
	);
}

/** A signed percent with two decimals for a price change: +2.41%, -0.87%. The input is a ratio: 0.0241. */
export function signedPercentFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

/** A share of a whole with at most one decimal: 36.4%. The input is a ratio: 0.364. */
export function shareFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
}

/** A count of days in words: "30 days", "1 day". Period controls use it. */
export function dayCountFormat(locale: string): Intl.NumberFormat {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
}

/**
 * Puts values into a message: fillMessage("{count} assets", { count: "14" }) gives "14 assets".
 * The values are already formatted with Intl. A name with no value stays as it is.
 */
export function fillMessage(
	template: string,
	values: Record<string, string>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(placeholder, name: string) => values[name] ?? placeholder,
	);
}
