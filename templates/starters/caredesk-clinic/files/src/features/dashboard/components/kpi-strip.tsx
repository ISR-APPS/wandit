// The KPI strip of the home: four figures in one card, split by rules, each with a tinted round icon chip.
// DashboardPage renders it in the Overview tab with the summary of the chosen period. It follows the "strip" KPI variant.
// The first figure counts the appointments of the period, not of today as the kit spec says: the period select controls the whole strip.
import {
	CalendarCheckIcon,
	CalendarXIcon,
	CurrencyDollarIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { fillMessage, moneyFormat } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { DashboardSummary, Figure } from "../lib/summary";

// One decimal shows 0.05 % and more. A smaller change shows as flat, with no color.
const FLAT_CHANGE = 0.0005;

// The chip tints, in cell order. Each figure takes the next chart color, as the kit strip does.
const CHIP_TINTS = [
	"bg-chart-1/15",
	"bg-chart-2/15",
	"bg-chart-3/15",
	"bg-chart-4/15",
];

type KpiStripProps = {
	summary: DashboardSummary;
	/** The period, in days. The delta line names it. */
	days: number;
};

/** One column on a phone, 2 x 2 on a mid width, 4 in a row from the 4xl container width. */
export function KpiStrip({ summary, days }: KpiStripProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const cells: {
		label: string;
		value: string;
		figure: Figure;
		goodWhen: "up" | "down";
		icon: KitIcon;
	}[] = [
		{
			label: t("dashboard.appointments"),
			value: number.format(summary.appointments.value),
			figure: summary.appointments,
			goodWhen: "up",
			icon: CalendarCheckIcon,
		},
		{
			label: t("dashboard.newPatients"),
			value: number.format(summary.newPatients.value),
			figure: summary.newPatients,
			goodWhen: "up",
			icon: UserPlusIcon,
		},
		{
			label: t("dashboard.noShows"),
			value: number.format(summary.noShows.value),
			figure: summary.noShows,
			goodWhen: "down",
			icon: CalendarXIcon,
		},
		{
			label: t("dashboard.revenue"),
			value: money.format(summary.revenue.value),
			figure: summary.revenue,
			goodWhen: "up",
			icon: CurrencyDollarIcon,
		},
	];

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<div className="grid @4xl/main:grid-cols-4 @xl/main:grid-cols-2">
				{cells.map((cell, index) => (
					<div
						key={cell.label}
						className={cn(
							"grid gap-4 p-6 transition-colors hover:bg-muted/50",
							// One rule between the cells in every layout: under a cell, then beside it.
							index < 3 && "border-b",
							index >= 2 && "@xl/main:border-b-0",
							"@4xl/main:border-b-0",
							index % 2 === 0 && "@xl/main:border-e",
							index === 1 && "@4xl/main:border-e",
						)}
					>
						<div className="flex items-start justify-between gap-4">
							<h2 className="pt-1 font-semibold leading-none">{cell.label}</h2>
							<span
								className={cn(
									"flex size-12 shrink-0 items-center justify-center rounded-full",
									CHIP_TINTS[index],
								)}
							>
								<cell.icon className="size-5" />
							</span>
						</div>
						<div className="grid gap-1">
							<p className="font-numeric font-semibold text-3xl tabular-nums">
								{cell.value}
							</p>
							<DeltaLine
								figure={cell.figure}
								goodWhen={cell.goodWhen}
								days={days}
							/>
						</div>
					</div>
				))}
			</div>
		</Card>
	);
}

type DeltaLineProps = {
	figure: Figure;
	/** "down" for a figure where a fall is good news, for example no-shows. */
	goodWhen: "up" | "down";
	days: number;
};

// "+4.2% vs the 30 days before". No earlier data never shows "0%".
function DeltaLine({ figure, goodWhen, days }: DeltaLineProps) {
	const { t, locale } = useT();
	if (figure.change === null) {
		return (
			<p className="text-muted-foreground text-xs">{t("kpi.noComparison")}</p>
		);
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const isFlat = Math.abs(figure.change) < FLAT_CHANGE;
	// The color says good or bad news, from goodWhen.
	const isGood = figure.change > 0 === (goodWhen === "up");
	return (
		<p className="text-muted-foreground text-xs">
			{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
			<bdi
				dir="ltr"
				className={cn(
					"font-medium tabular-nums",
					!isFlat && (isGood ? "text-success" : "text-destructive"),
				)}
			>
				{percent.format(figure.change)}
			</bdi>{" "}
			{fillMessage(t("kpi.vsBefore"), { period: dayCount.format(days) })}
		</p>
	);
}
