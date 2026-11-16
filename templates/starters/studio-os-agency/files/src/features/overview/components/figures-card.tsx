// The figures of the overview tab that no entity row shows: open money, team utilization, and projects at risk.
// It is the kpi form "icon" as a ruled list: an icon chip, the label, the value, and the delta.
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { KpiItem } from "../lib/series";
import { ChangeLine } from "./change-line";

/** One figure with its translated label and its icon. */
export type FigureRow = {
	item: KpiItem;
	label: string;
	icon: KitIcon;
	/** Translated line under the label, shown in place of the delta. For a figure with no history. */
	note?: string;
};

type FiguresCardProps = {
	/** The panel title, already translated. */
	title: string;
	/** At most 3 figures. */
	rows: FigureRow[];
};

/** The value sits at the end of each row, in the numeral face, so the three figures line up. */
export function FiguresCard({ title, rows }: FiguresCardProps) {
	const { locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			{/* The card can be taller than its rows beside a long breakdown, so the rows share the height. */}
			<CardContent className="flex-1">
				<ul className="grid h-full auto-rows-fr">
					{rows.map(({ item, label, icon: Icon, note }) => (
						<li
							key={item.id}
							className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b py-4 first:pt-0 last:border-b-0 last:pb-0"
						>
							<span className="flex size-9 items-center justify-center rounded-control bg-accent text-accent-foreground">
								<Icon className="size-4" />
							</span>
							<div className="grid gap-0.5">
								<p className="label-text text-sm">{label}</p>
								{note ? (
									<p className="text-muted-foreground text-xs">{note}</p>
								) : (
									<ChangeLine item={item} className="text-xs" />
								)}
							</div>
							<p className="font-numeric font-semibold text-2xl tabular-nums">
								{new Intl.NumberFormat(locale, item.format).format(item.value)}
							</p>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
