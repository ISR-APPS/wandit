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

/** Native details/summary keeps the order metadata compact and keyboard-usable. */
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
					className="mt-1 max-w-64 truncate text-muted-foreground text-xs"
				>
					{summaryText}
				</p>
			) : null}
			<details className="mt-2 text-xs">
				<summary className="w-fit cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground">
					{ORDER_DETAILS_LABEL}
				</summary>
				<dl className="mt-2 grid gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-2 sm:grid-cols-[max-content_minmax(0,1fr)]">
					{entries.map(([key, value]) => (
						<div key={key} className="grid grid-cols-subgrid sm:col-span-2">
							<dt dir="auto" className="break-words text-muted-foreground">
								{key}
							</dt>
							<dd dir="auto" className="break-words font-medium">
								{displayExtraValue(value)}
							</dd>
						</div>
					))}
				</dl>
			</details>
		</>
	);
}
