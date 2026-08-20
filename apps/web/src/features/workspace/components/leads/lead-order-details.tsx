import {
	type Lead,
	type LeadExtras,
	publicLeadExtraEntries,
	splitLeadOrderExtras,
} from "@wandit/contracts";

import { ORDER_DETAILS_LABEL } from "../../lib/helpers";

/** Fallback prefix of the grand-total part in the summary line — callers
 * pass the localized leads.orderTotal when a dictionary is available. */
const ORDER_TOTAL_LABEL = "Total";

function displayExtraValue(value: LeadExtras[string]): string {
	return value === null ? "null" : String(value);
}

/**
 * One always-visible line with the commercial facts of the order — product
 * (× quantity), delivery choice and grand total — so the merchant reads what
 * was bought without opening the disclosure. Built from the same promoted
 * order fields the exports use.
 */
function orderSummaryText(
	extras: Lead["extras"],
	totalLabel: string,
): string | null {
	const { order } = splitLeadOrderExtras(extras);
	// Empty strings (an untouched optional input) count as absent — they must
	// not leave a stray separator in the joined line.
	const text = (value: LeadExtras[string] | undefined) => {
		if (value === null || value === undefined) return undefined;
		const rendered = String(value);
		return rendered === "" ? undefined : rendered;
	};

	const product = text(order.product);
	const quantity = text(order.quantity);
	const delivery = text(order.delivery);
	const total = text(order.total);

	const parts = [
		product ? (quantity ? `${product} × ${quantity}` : product) : undefined,
		delivery,
		total ? `${totalLabel}: ${total}` : undefined,
	].filter((part) => part !== undefined);

	return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Native details/summary keeps the order metadata compact and keyboard-usable.
 *
 * Layout notes — the block lives inside a `TableCell` (`whitespace-nowrap`)
 * whose column can be squeezed to its min-content width on narrow screens:
 * - `whitespace-normal` + `wrap-anywhere` let long values (emails, free text)
 *   wrap instead of running over the neighbouring columns.
 * - The label track is `max-content` (capped by `sm:max-w-40` on the `dt`) so
 *   labels never wrap while the column is squeezed, and the value track keeps
 *   an `8rem` floor so values never collapse to zero width.
 * - `w-fit max-w-md` keeps the block hugging its content on wide screens.
 * - Each `dt`/`dd` carries `dir="auto"` for correct bidi rendering of Arabic
 *   values, and `justify-self-start` + `w-fit` keep every box hugging its text
 *   at the reading start of the UI — an RTL value no longer jumps to the far
 *   edge of its cell (or overflows across the label when the cell is narrow).
 * - The summary line hugs its text only from `md:` (the table breakpoint): a
 *   `truncate` block with `w-fit` ignores its container width, which is safe
 *   in a table cell but would overflow a very narrow mobile card.
 */
export function LeadOrderDetails({
	extras,
	totalLabel = ORDER_TOTAL_LABEL,
}: {
	extras: Lead["extras"];
	totalLabel?: string;
}) {
	const entries = publicLeadExtraEntries(extras);
	if (entries.length === 0) return null;
	const summaryText = orderSummaryText(extras, totalLabel);

	return (
		<>
			{summaryText ? (
				<p
					dir="auto"
					title={summaryText}
					className="mt-1 max-w-64 truncate text-muted-foreground text-xs md:w-fit"
				>
					{summaryText}
				</p>
			) : null}
			<details className="mt-2 text-xs">
				<summary className="w-fit cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
					{ORDER_DETAILS_LABEL}
				</summary>
				<dl className="mt-2 grid w-fit max-w-md gap-x-3 gap-y-1 whitespace-normal rounded-lg bg-muted/50 p-2 sm:grid-cols-[max-content_minmax(8rem,1fr)]">
					{entries.map(([key, value]) => (
						<div key={key} className="grid grid-cols-subgrid sm:col-span-2">
							<dt
								dir="auto"
								className="wrap-anywhere justify-self-start text-muted-foreground sm:max-w-40"
							>
								{key}
							</dt>
							<dd
								dir="auto"
								className="wrap-anywhere max-w-full justify-self-start font-medium"
							>
								{displayExtraValue(value)}
							</dd>
						</div>
					))}
				</dl>
			</details>
		</>
	);
}
