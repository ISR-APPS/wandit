// The parse of the trade card fields: the text of the units field or of the amount field, typed by the user.
// TradeCard calls parseTradeQuantity in its submit handler. The result goes to useRecordTradeMutation.
import { z } from "zod";

// A field holds a plain decimal number: "0.5", "1200", "12.75". The input has inputMode="decimal".
const amountFieldSchema = z.coerce.number().finite().positive();

/** Why a trade does not go through. The card shows the matching message under the fields. */
export type TradeError = "invalidAmount" | "aboveHeld";

/**
 * The units of a trade from the field that the user typed in, rounded to 8 decimals.
 * `field` "usd" divides the amount by `unitPrice`. A sell above `sellableQuantity` is refused.
 */
export function parseTradeQuantity(input: {
	/** The raw text of the field that the user typed in last. */
	text: string;
	/** "units" for the asset field, "usd" for the money field. */
	field: "units" | "usd";
	/** The current price of one unit, above 0. */
	unitPrice: number;
	/** Units held now minus the units of pending sells. null for a buy, which has no upper limit. */
	sellableQuantity: number | null;
}): { ok: true; quantity: number } | { ok: false; error: TradeError } {
	const parsed = amountFieldSchema.safeParse(input.text.trim());
	if (!parsed.success || input.unitPrice <= 0) {
		return { ok: false, error: "invalidAmount" };
	}
	const units =
		input.field === "units" ? parsed.data : parsed.data / input.unitPrice;
	// 8 decimals is the smallest unit that the ledger stores.
	const quantity = Math.round(units * 1e8) / 1e8;
	if (quantity <= 0) {
		return { ok: false, error: "invalidAmount" };
	}
	if (input.sellableQuantity !== null && quantity > input.sellableQuantity) {
		return { ok: false, error: "aboveHeld" };
	}
	return { ok: true, quantity };
}
