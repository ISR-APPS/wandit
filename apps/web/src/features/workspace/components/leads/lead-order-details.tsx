import {
	type Lead,
	type LeadExtras,
	publicLeadExtraEntries,
} from "@wandit/contracts";

import { ORDER_DETAILS_LABEL } from "../../lib/helpers";

function displayExtraValue(value: LeadExtras[string]): string {
	return value === null ? "null" : String(value);
}

/** Native details/summary keeps the order metadata compact and keyboard-usable. */
export function LeadOrderDetails({ extras }: { extras: Lead["extras"] }) {
	const entries = publicLeadExtraEntries(extras);
	if (entries.length === 0) return null;

	return (
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
	);
}
