// One wide row of the overview tab: an entity, its headline figure with the delta, a mini trend, and a link to its tab.
// OverviewPage renders one row per entity tab (projects, team, invoices). Every row uses the same period and plot height.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import { CaretRightIcon, type KitIcon } from "~/shared/ui/icons";
import type { OverviewTab } from "../lib/overview-search";
import type { DailyPoint, KpiItem } from "../lib/series";
import { ChangeLine } from "./change-line";
import { CompareTrend } from "./compare-trend";

type EntityRowProps = {
	/** The tab that the row opens. */
	tab: Exclude<OverviewTab, "overview">;
	/** The entity name, already translated: "Projects". */
	name: string;
	/** The icon of the counted thing. It sits in a chip before the name. */
	icon: KitIcon;
	/** The headline figure of the entity. */
	item: KpiItem;
	/** The label of the figure, already translated: "Deliverables approved". */
	label: string;
	/** How the plot counts, already translated: "Rolling 7-day total". */
	hint: string;
	/** The daily series of the figure, for the mini trend. */
	points: DailyPoint[];
};

/** At 375 px the row stacks: the name, the figure, and the link on top, then the plot at full width. */
export function EntityRow({
	tab,
	name,
	icon: Icon,
	item,
	label,
	hint,
	points,
}: EntityRowProps) {
	const { t, locale } = useT();
	const value = new Intl.NumberFormat(locale, item.format).format(item.value);
	return (
		<Card className="grid @2xl/main:grid-cols-[17rem_minmax(0,1fr)_auto] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-4 px-6 py-5">
			<div className="col-start-1 row-start-1 grid gap-3">
				<p className="flex items-center gap-2.5 font-semibold text-sm">
					<span className="flex size-8 items-center justify-center rounded-control bg-secondary text-secondary-foreground">
						<Icon className="size-4" />
					</span>
					{name}
				</p>
				<div className="grid gap-1.5">
					<p className="label-text text-muted-foreground text-xs">{label}</p>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span className="font-numeric font-semibold text-3xl tabular-nums leading-none">
							{value}
						</span>
						<ChangeLine item={item} />
					</div>
				</div>
			</div>
			<div className="@2xl/main:col-span-1 col-span-2 @2xl/main:col-start-2 @2xl/main:row-start-1 row-start-2 grid gap-1">
				<CompareTrend
					title={label}
					points={points}
					format={item.format}
					size="mini"
					className="h-20"
				/>
				<p className="text-end text-muted-foreground text-xs">{hint}</p>
			</div>
			<Link
				to="/app"
				search={(previous) => ({ ...previous, tab })}
				className="@2xl/main:col-start-3 col-start-2 row-start-1 inline-flex min-h-11 items-center gap-1 self-start @2xl/main:self-center justify-self-end rounded-control px-2 font-medium text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{t("overview.openTab")}
				<span className="sr-only">{name}</span>
				<CaretRightIcon className="size-4 rtl:rotate-180" />
			</Link>
		</Card>
	);
}
