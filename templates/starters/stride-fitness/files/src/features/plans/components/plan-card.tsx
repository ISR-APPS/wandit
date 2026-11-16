// One membership plan on the plans page: the price, the rules, the members, and the monthly value.
// PlansPage renders one card per plan. The link opens the members list filtered on this plan.
// The color mark matches the slice of the plan in the revenue donut.
import { Link } from "@tanstack/react-router";
import { PLAN_CURRENCY } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { PLAN_CHART_COLOR, type PlanSummary } from "../lib/plan-summary";

type PlanCardProps = {
	summary: PlanSummary;
	/** Active members of the gym, all plans. The bar shows the share of this plan. */
	activeTotal: number;
};

/** The card fills its grid cell, so the cards of one row have equal heights. */
export function PlanCard({ summary, activeTotal }: PlanCardProps) {
	const { t, locale } = useT();
	const { plan } = summary;
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: PLAN_CURRENCY,
		maximumFractionDigits: 0,
	});
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });

	return (
		<Card className="h-full gap-5">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<span
						aria-hidden="true"
						className={cn(
							"size-2.5 shrink-0 rounded-badge",
							PLAN_CHART_COLOR[plan.id].mark,
						)}
					/>
					{plan.name}
				</CardTitle>
				{/* Minimum heights line up the parts of the cards in one row. The texts wrap to 3, 2, then 3 lines as the grid changes. */}
				<CardDescription className="@2xl/main:min-h-[3lh] @4xl/main:min-h-[2lh] @5xl/main:min-h-[3lh]">
					{plan.summary}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<p className="flex items-baseline gap-1.5">
					<span className="font-numeric text-3xl tabular-nums">
						{money.format(plan.price)}
					</span>
					<span className="text-muted-foreground text-sm">
						{t(plan.billing === "year" ? "plans.perYear" : "plans.perMonth")}
					</span>
				</p>
				<ul className="grid @2xl/main:min-h-[3lh] @4xl/main:min-h-[2lh] @5xl/main:min-h-[3lh] content-start text-sm">
					<li>
						{plan.classesPerMonth === null
							? t("plans.unlimitedClasses")
							: `${number.format(plan.classesPerMonth)} ${t("plans.classesPerMonth")}`}
					</li>
					<li>
						{t(plan.access === "all" ? "plans.allHours" : "plans.offPeakHours")}
					</li>
				</ul>
				<div className="grid gap-2 border-t pt-4">
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-muted-foreground text-sm">
							{t("plans.activeMembers")}
						</span>
						<span className="font-numeric text-lg tabular-nums">
							{number.format(summary.activeCount)}
						</span>
					</div>
					<Progress
						value={summary.activeCount}
						max={activeTotal}
						aria-label={t("plans.activeMembers")}
						className="h-1.5"
					/>
					<p className="text-muted-foreground text-xs">
						<bdi dir="ltr" className="tabular-nums">
							{percent.format(
								activeTotal === 0 ? 0 : summary.activeCount / activeTotal,
							)}
						</bdi>
						{` ${t("plans.ofActive")}`}
						{summary.frozenCount > 0
							? ` · ${number.format(summary.frozenCount)} ${t("plans.frozen")}`
							: null}
					</p>
				</div>
				<div className="flex items-baseline justify-between gap-2">
					<span className="text-muted-foreground text-sm">
						{t("plans.monthlyValue")}
					</span>
					<span className="font-numeric tabular-nums">
						{money.format(summary.monthlyValue)}
					</span>
				</div>
			</CardContent>
			<CardFooter className="mt-auto">
				<Link
					to="/app/members"
					search={{ plan: plan.id }}
					className="inline-flex min-h-11 items-center gap-1.5 font-medium text-sm hover:underline"
				>
					{t("plans.seeMembers")}
					<ArrowRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}
