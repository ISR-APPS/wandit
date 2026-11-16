// One wide row of the overview tab: an entity, its headline figure with the delta, a mini trend, and a link to its tab.
// OverviewPage renders one row per entity tab (tasks, bugs). Every row uses the same period and plot height.
import { Link } from "@tanstack/react-router";
import type { DailyPoint } from "~/features/tracker";
import { ChangePill } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import { CaretRightIcon, type KitIcon } from "~/shared/ui/icons";
import type { KpiItem } from "../lib/overview-data";
import type { OverviewTab } from "../lib/overview-search";
import { CompareTrend } from "./compare-trend";

type EntityRowProps = {
	/** The tab that the row opens. */
	tab: Exclude<OverviewTab, "overview">;
	/** The entity name, already translated: "Tasks". */
	name: string;
	icon: KitIcon;
	/** The headline figure of the entity, with its label already translated. */
	item: KpiItem & { label: string };
	/** The daily series of the figure, for the mini trend. */
	points: DailyPoint[];
};

/** At 375 px the row stacks: the name and the figure, then the plot, then the link. */
export function EntityRow({
	tab,
	name,
	icon: Icon,
	item,
	points,
}: EntityRowProps) {
	const { t, locale } = useT();
	const value = new Intl.NumberFormat(locale, item.format).format(item.value);
	return (
		<Card className="grid @2xl/main:grid-cols-[15rem_minmax(0,1fr)_auto] grid-cols-1 items-center gap-x-6 gap-y-3 px-6 py-5">
			<div className="grid gap-2">
				<p className="flex items-center gap-2 font-medium text-sm">
					<span className="flex size-7 items-center justify-center rounded-control bg-secondary text-secondary-foreground">
						<Icon className="size-4" />
					</span>
					{name}
				</p>
				<div className="grid gap-1">
					<p className="label-text text-muted-foreground text-xs">
						{item.label}
					</p>
					<p className="flex flex-wrap items-center gap-2">
						<span className="font-numeric font-semibold text-3xl tabular-nums leading-none">
							{value}
						</span>
						{item.change === null ? null : (
							<ChangePill change={item.change} goodWhen={item.goodWhen} />
						)}
					</p>
					{item.change === null ? (
						<p className="text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</p>
					) : null}
				</div>
			</div>
			<CompareTrend
				title={item.label}
				points={points}
				size="mini"
				className="h-20"
			/>
			<Link
				to="/app"
				search={{ tab }}
				className="inline-flex min-h-11 items-center gap-1 justify-self-start @2xl/main:justify-self-end rounded-control px-2 font-medium text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{t("overview.openTab")}
				<span className="sr-only">{name}</span>
				<CaretRightIcon className="size-4 rtl:rotate-180" />
			</Link>
		</Card>
	);
}
