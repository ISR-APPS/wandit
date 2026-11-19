// The visit types card of the home: the visits of the period, the change, a stacked bar, and the 5 largest kinds of visit.
// The bar ends with one muted segment for the smaller kinds, so it always fills to 100 %.
// DashboardPage renders it last in the row of 3 of the Overview tab, with the summary of the chosen period.
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CaretDoubleRightIcon,
	InfoIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import type { VisitTypeTotal } from "../lib/summary";

// The bar and the list show the 5 largest kinds, as the kit treatment card does.
const SHOWN_TYPES = 5;
// Chart series 1 to 5, by rank. Written in full so that Tailwind builds each class.
const RANK_DOTS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
];

type VisitTypesCardProps = {
	/** Every kind of visit done in the period, the largest first. */
	visitTypes: VisitTypeTotal[];
	/** Visits done in the period. */
	total: number;
	/** Visits done in the period before. */
	previousTotal: number;
};

/** Each row names its share of all the visits, so the bar segments never rely on color alone. */
export function VisitTypesCard({
	visitTypes,
	total,
	previousTotal,
}: VisitTypesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const shown = visitTypes.slice(0, SHOWN_TYPES);
	// The kinds after the 5 largest share one "other" segment, so the segments add up to the total.
	const otherVisits = total - shown.reduce((sum, type) => sum + type.visits, 0);
	const difference = total - previousTotal;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{t("dashboard.visitTypesTitle")}
					<Tooltip>
						<TooltipTrigger
							className="rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
							aria-label={t("dashboard.visitTypesHelp")}
						>
							<InfoIcon className="size-4" />
						</TooltipTrigger>
						<TooltipContent>{t("dashboard.visitTypesHelp")}</TooltipContent>
					</Tooltip>
				</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="ghost"
						size="sm"
						className="-me-2 text-muted-foreground"
					>
						<Link to="/app/appointments">
							{t("dashboard.seeDetails")}
							<CaretDoubleRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<div className="grid gap-4">
					<div className="flex items-baseline gap-2">
						<span className="font-numeric font-semibold text-3xl tabular-nums">
							{number.format(total)}
						</span>
						{/* No earlier visit gives no change, so no badge shows. */}
						{previousTotal > 0 && difference !== 0 ? (
							<Badge
								variant="outline"
								className={cn(
									"bg-transparent",
									difference > 0
										? "border-success text-success"
										: "border-destructive text-destructive",
								)}
							>
								{difference > 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
								<span className="tabular-nums">
									{number.format(Math.abs(difference))}
								</span>
								<span className="sr-only">{t("kpi.vsPrevious")}</span>
							</Badge>
						) : null}
					</div>
					{total === 0 ? (
						<div className="h-2 w-full rounded-full bg-muted" />
					) : (
						<div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
							{shown.map((type, index) => (
								<div
									key={type.visitType}
									className={RANK_DOTS[index]}
									style={{ width: `${(type.visits / total) * 100}%` }}
								/>
							))}
							{otherVisits > 0 ? (
								<div
									className="bg-muted-foreground/40"
									title={fillMessage(t("dashboard.otherVisitTypes"), {
										share: percent.format(otherVisits / total),
									})}
									style={{ width: `${(otherVisits / total) * 100}%` }}
								/>
							) : null}
						</div>
					)}
				</div>
				{shown.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noVisit")}
					</p>
				) : (
					<ul className="grid gap-5">
						{shown.map((type, index) => (
							<li
								key={type.visitType}
								className="flex items-start justify-between gap-4"
							>
								<div className="flex min-w-0 gap-3">
									<span
										aria-hidden="true"
										className={cn(
											"mt-1.5 size-3 shrink-0 rounded-full",
											RANK_DOTS[index],
										)}
									/>
									<div className="min-w-0">
										<p className="font-medium text-sm">
											{t(`visitTypes.${type.visitType}`)}
										</p>
										<p className="text-muted-foreground text-sm">
											{fillMessage(t("dashboard.patientCount"), {
												count: number.format(type.patients),
											})}
										</p>
									</div>
								</div>
								<span className="shrink-0 font-medium text-sm tabular-nums">
									{percent.format(type.visits / total)}
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
