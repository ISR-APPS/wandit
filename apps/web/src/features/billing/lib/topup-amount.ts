/**
 * Amount helpers of the top-up kit: the parser of a typed amount, and the Spark Meter scale.
 * Called by components/topup-amount-picker.tsx, topup-dialog.tsx, and wallet-topup-card.tsx.
 * The API parses the amount again with topupAmountUsdSchema.
 */

/** Amount in whole USD that the dialog and the wallet card select when nothing else sets one. */
export const TOPUP_DEFAULT_AMOUNT_USD = 20;

/**
 * Stops of the Spark Meter, in whole USD, ascending. The thumb travels the same distance between two stops.
 * So the small amounts get most of the track, and 1000 USD is still on it.
 */
export const TOPUP_METER_STOPS_USD = [10, 20, 40, 100, 200, 500, 1000] as const;

/** Slider positions between two stops. 1 position is 0.1 USD at the start and 5 USD at the end. */
const METER_POSITIONS_PER_SEGMENT = 100;

/** Last slider position of the meter. The first position is 0. */
export const TOPUP_METER_MAX_POSITION =
	(TOPUP_METER_STOPS_USD.length - 1) * METER_POSITIONS_PER_SEGMENT;

/** Whole USD at a slider position. The scale is linear inside each segment. A position off the track is clamped. */
export function meterPositionToUsd(position: number): number {
	const clamped = Math.min(Math.max(position, 0), TOPUP_METER_MAX_POSITION);
	// The last position belongs to the last segment, not to a segment after it.
	const segment = Math.min(
		Math.floor(clamped / METER_POSITIONS_PER_SEGMENT),
		TOPUP_METER_STOPS_USD.length - 2,
	);
	const fromUsd = TOPUP_METER_STOPS_USD[segment];
	const toUsd = TOPUP_METER_STOPS_USD[segment + 1];
	const ratio =
		(clamped - segment * METER_POSITIONS_PER_SEGMENT) /
		METER_POSITIONS_PER_SEGMENT;
	return Math.round(fromUsd + (toUsd - fromUsd) * ratio);
}

/**
 * Slider position of an amount in USD, as a decimal, so a typed amount puts the thumb at its exact place.
 * An amount off the meter is clamped to the first or the last stop.
 */
export function usdToMeterPosition(usd: number): number {
	const firstUsd = TOPUP_METER_STOPS_USD[0];
	const lastUsd = TOPUP_METER_STOPS_USD[TOPUP_METER_STOPS_USD.length - 1];
	const clamped = Math.min(Math.max(usd, firstUsd), lastUsd);
	// The segment of the amount starts at the last stop below the amount. The last stop starts no segment.
	const segment = Math.min(
		TOPUP_METER_STOPS_USD.findLastIndex((stopUsd) => stopUsd <= clamped),
		TOPUP_METER_STOPS_USD.length - 2,
	);
	const fromUsd = TOPUP_METER_STOPS_USD[segment];
	const toUsd = TOPUP_METER_STOPS_USD[segment + 1];
	return (
		(segment + (clamped - fromUsd) / (toUsd - fromUsd)) *
		METER_POSITIONS_PER_SEGMENT
	);
}

/**
 * The next meter stop above `usd` (direction 1) or below it (direction -1), for the Page Up and Page Down keys.
 * Returns the last or the first stop when no stop is further in that direction.
 */
export function adjacentMeterStopUsd(usd: number, direction: 1 | -1): number {
	const stop =
		direction === 1
			? TOPUP_METER_STOPS_USD.find((stopUsd) => stopUsd > usd)
			: TOPUP_METER_STOPS_USD.findLast((stopUsd) => stopUsd < usd);
	return (
		stop ??
		(direction === 1
			? TOPUP_METER_STOPS_USD[TOPUP_METER_STOPS_USD.length - 1]
			: TOPUP_METER_STOPS_USD[0])
	);
}

/** Result of parseTopupAmountUsd. Only `valid` carries an amount that the dialog can send. */
export type TopupAmountParseResult =
	| { kind: "valid"; amountUsd: number }
	| { kind: "empty" }
	| { kind: "notWholeNumber" }
	| { kind: "belowMinimum" }
	| { kind: "aboveMaximum" };

// Arabic-Indic (U+0660) and Extended Arabic-Indic (U+06F0) digits. Users in ar type them on purpose.
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Turns typed text into whole USD inside the API limits.
 * Converts Arabic-Indic digits to ASCII. Rejects a sign, a decimal point or comma, a space inside, and letters.
 */
export function parseTopupAmountUsd(
	text: string,
	limits: {
		/** Whole USD, from GET billing/wallet `topup.minAmountUsd`. */
		minAmountUsd: number;
		/** Whole USD, from GET billing/wallet `topup.maxAmountUsd`. */
		maxAmountUsd: number;
	},
): TopupAmountParseResult {
	const digits = text
		.trim()
		.replace(ARABIC_INDIC_DIGITS, (digit) =>
			String((digit.codePointAt(0) ?? 0) & 0xf),
		);

	if (digits === "") {
		return { kind: "empty" };
	}
	// Only ASCII digits. "25.5", "25,5", "-25", "1e3", and "0x10" all fail here, before Number() can accept them.
	if (!/^\d+$/.test(digits)) {
		return { kind: "notWholeNumber" };
	}

	const amountUsd = Number(digits);
	if (amountUsd < limits.minAmountUsd) {
		return { kind: "belowMinimum" };
	}
	if (amountUsd > limits.maxAmountUsd) {
		return { kind: "aboveMaximum" };
	}
	return { kind: "valid", amountUsd };
}
