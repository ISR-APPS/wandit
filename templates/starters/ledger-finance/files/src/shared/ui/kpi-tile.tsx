// One KPI card in the kit "tile" form: a small icon tile before the label, then the figure.
// OverviewPage renders four of them and BudgetKpis renders four. The caller puts the value, the delta, and the buttons in `children`.
// A card with a `chart` drops its bottom padding, so the mini bars sit on the bottom edge.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type KpiTileProps = {
	/** The translated name of the figure, for example "Net profit". */
	label: string;
	/** A Phosphor icon that names the figure. It sits in a bordered tile. */
	icon: KitIcon;
	/** A badge at the end of the header row, for example the share of the card limit. */
	badge?: ReactNode;
	/** A chart under the body, edge to edge. */
	chart?: ReactNode;
	/** The figure, its delta, and the actions, top to bottom. */
	children: ReactNode;
};

/** The body spreads its children from top to bottom, so the four cards of a row align their deltas. */
export function KpiTile({
	label,
	icon: Icon,
	badge,
	chart,
	children,
}: KpiTileProps) {
	return (
		<Card className={cn(chart ? "overflow-hidden pb-0" : null)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-3 font-medium text-muted-foreground text-sm">
					<span
						aria-hidden="true"
						className="flex size-7 shrink-0 items-center justify-center rounded-md border"
					>
						<Icon className="size-4" />
					</span>
					{label}
				</CardTitle>
				{badge ? <CardAction>{badge}</CardAction> : null}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col justify-between gap-4">
				{children}
			</CardContent>
			{chart}
		</Card>
	);
}
