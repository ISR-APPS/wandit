// One of the 4 stat cards of the home: the label, the value, and a delta line with a short context.
// DashboardPage renders 4 of them in a 2 x 2 grid beside the sales chart, as the kit sales page does.
// The card ground is a light tint of one chart color, and an icon tile names the figure (KPI variant "tinted").
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CalculatorIcon,
	ChairIcon,
	CoinsIcon,
	type Icon,
	ReceiptIcon,
} from "@phosphor-icons/react";
import {
	changeFormat,
	countLabel,
	fillMessage,
	formatCents,
	isGoodChange,
	moneyFormat,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { StatContextValue, StatItem } from "../lib/dashboard";

// Each figure has its own chart color and icon, so the 4 tinted cards stay apart.
const STAT_LOOK = {
	sales: { icon: CoinsIcon, card: "bg-chart-1/10", tile: "bg-chart-1" },
	checks: { icon: ReceiptIcon, card: "bg-chart-2/10", tile: "bg-chart-2" },
	average: { icon: CalculatorIcon, card: "bg-chart-3/10", tile: "bg-chart-3" },
	tables: { icon: ChairIcon, card: "bg-chart-4/10", tile: "bg-chart-4" },
} satisfies Record<StatItem["id"], { icon: Icon; card: string; tile: string }>;

type StatCardProps = {
	stat: StatItem;
};

/** A null change shows the context line alone, never "0%". */
export function StatCard({ stat }: StatCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const look = STAT_LOOK[stat.id];
	const formatContext = (value: StatContextValue): string => {
		switch (value.kind) {
			case "money":
				return formatCents(money, value.cents);
			case "count":
				return countLabel(
					value.count,
					t(`counts.${value.noun}.one`),
					t(`counts.${value.noun}.other`),
					locale,
				);
			case "number":
				return number.format(value.value);
		}
	};
	const context = fillMessage(
		t(stat.contextKey),
		Object.fromEntries(
			Object.entries(stat.context).map(([key, value]) => [
				key,
				formatContext(value),
			]),
		),
	);
	const ArrowIcon =
		stat.change !== null && stat.change < 0 ? ArrowDownIcon : ArrowUpIcon;

	return (
		<Card className={look.card}>
			<CardHeader className="gap-1">
				<CardDescription>{t(stat.labelKey)}</CardDescription>
				<CardAction>
					<span
						aria-hidden="true"
						className={cn(
							"flex size-10 items-center justify-center rounded-control text-primary-foreground",
							look.tile,
						)}
					>
						<look.icon className="size-5" />
					</span>
				</CardAction>
				<p className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{stat.isMoney
						? formatCents(money, stat.value)
						: number.format(stat.value)}
				</p>
				<p className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
					{stat.change === null ? null : (
						<span
							className={cn(
								"flex items-center gap-0.5 font-medium",
								isGoodChange(stat.change, "up")
									? "text-success"
									: "text-destructive",
							)}
						>
							<ArrowIcon className="size-3" />
							{/* dir="ltr" keeps "+3.6%" in this order in an Arabic page. */}
							<bdi dir="ltr" className="tabular-nums">
								{changeFormat(locale).format(stat.change)}
							</bdi>
						</span>
					)}
					<span>{context}</span>
				</p>
			</CardHeader>
		</Card>
	);
}
