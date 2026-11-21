// One KPI card of the billing page in the "tile" variant of the kit system: a small icon tile before the label,
// an optional badge at the end of the head, the value, then the content of the card (a delta, buttons, or bars).
// BillingPage renders four of them in its KPI row, as the kit finance page.
import type { ReactNode } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type BillingKpiCardProps = {
	label: string;
	icon: KitIcon;
	/** The formatted value, for example "$48,200" or "24 days". */
	value: string;
	/** A Badge at the end of the head, for example the count of overdue invoices. */
	badge?: ReactNode;
	/** The lines under the value: a delta line, two buttons, or a bar spark. */
	children: ReactNode;
};

/** The children sit at the bottom of the card, so the values of the row stay on one line. */
export function BillingKpiCard({
	label,
	icon: Icon,
	value,
	badge,
	children,
}: BillingKpiCardProps) {
	return (
		<Card>
			<CardHeader className="items-center">
				<CardTitle className="flex items-center gap-2 font-medium text-sm">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
						<Icon className="size-4" />
					</span>
					{label}
				</CardTitle>
				{badge ? <CardAction>{badge}</CardAction> : null}
			</CardHeader>
			<CardContent className="grid flex-1 content-between gap-4">
				<p className="font-numeric font-semibold text-3xl tabular-nums">
					{value}
				</p>
				{children}
			</CardContent>
		</Card>
	);
}
