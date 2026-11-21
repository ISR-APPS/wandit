// One KPI card of the home in the "tile" form: a small bordered icon tile before the label,
// a large value, and the change line at the bottom. OverviewPage renders four of them in the KPI row.
// `children` adds the extra part of one card: the buttons of the balance card, or the mini bars of the card spend.
import type { ReactNode } from "react";
import { ChangeLine } from "~/features/bank";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type KpiTileCardProps = {
	icon: KitIcon;
	label: string;
	/** A Badge at the end of the head, for example "2 near the limit". */
	badge?: ReactNode;
	/** The formatted value, for example "$128,450". */
	value: string;
	/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, such as money out. */
	goodWhen: "up" | "down";
	/** A short text after the delta that says what it compares. It shows only when a delta exists. */
	context: string;
	/** Content under the change line. A card with mini bars passes them and sets `isFlush`. */
	children?: ReactNode;
	/** True removes the bottom padding, so the mini bars sit on the card edge as in the kit. */
	isFlush?: boolean;
};

/** The value and the change line push apart, so the four cards of a row align their figures. */
export function KpiTileCard({
	icon: Icon,
	label,
	badge,
	value,
	change,
	goodWhen,
	context,
	children,
	isFlush = false,
}: KpiTileCardProps) {
	return (
		<Card className={isFlush ? "overflow-hidden pb-0" : undefined}>
			<CardHeader>
				<CardTitle className="flex items-center gap-3 font-medium text-muted-foreground text-sm">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
						<Icon className="size-4" />
					</span>
					{label}
				</CardTitle>
				{badge ? <CardAction>{badge}</CardAction> : null}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col justify-between gap-4">
				<p className="font-numeric font-semibold text-3xl tabular-nums">
					{value}
				</p>
				<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
					<ChangeLine change={change} goodWhen={goodWhen} />
					{change === null ? null : <span>{context}</span>}
				</div>
			</CardContent>
			{children}
		</Card>
	);
}
