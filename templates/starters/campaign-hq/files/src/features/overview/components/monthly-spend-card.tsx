// The spend card of the home: return on ad spend of 6 months, stacked monthly spend bars, and two money rows.
// OverviewPage renders it in the third row. It reads monthlySpendQueryOptions, which the home loader prefetches.
// The badge compares the return of the last full month with the month before it.
import { CoinsIcon, HandCoinsIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
	DeltaBadge,
	formatMultiple,
	moneyFormat,
	returnOnSpend,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { monthlySpendQueryOptions } from "../api/overview.queries";

const MonthlySpendBars = lazy(() =>
	import("./monthly-spend-bars").then((module) => ({
		default: module.MonthlySpendBars,
	})),
);

/** Revenue is good news in green, spend a cost in red, as the two rows of the kit "total" card. */
export function MonthlySpendCard() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(monthlySpendQueryOptions());
	const money = moneyFormat(locale, "compact");
	const rows = [
		{
			key: "revenue",
			icon: HandCoinsIcon,
			title: t("metrics.revenue"),
			hint: t("overview.revenueHint"),
			amount: `+${money.format(data.totals.revenue)}`,
			tone: "text-success",
		},
		{
			key: "spend",
			icon: CoinsIcon,
			title: t("metrics.spend"),
			hint: t("overview.spendHint"),
			amount: `-${money.format(data.totals.spend)}`,
			tone: "text-destructive",
		},
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.spendTitle")}</CardDescription>
				<CardAction>
					<DeltaBadge
						change={data.change}
						goodWhen="up"
						srLabel={t("overview.vsMonthBefore")}
					/>
				</CardAction>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{formatMultiple(returnOnSpend(data.totals), locale)}
				</p>
			</CardHeader>
			<CardContent className="grid gap-5">
				<Suspense fallback={<Skeleton className="aspect-21/9 w-full" />}>
					<MonthlySpendBars months={data.months} />
				</Suspense>
				<ul className="grid gap-4">
					{rows.map((row) => {
						const Icon = row.icon;
						return (
							<li key={row.key} className="flex items-center gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
									<Icon className="size-4" />
								</span>
								<div className="grid min-w-0">
									<span className="font-medium">{row.title}</span>
									<span className="truncate text-muted-foreground text-xs">
										{row.hint}
									</span>
								</div>
								{/* dir="ltr" keeps the sign before the amount in an Arabic page. */}
								<bdi
									dir="ltr"
									className={`ms-auto text-sm tabular-nums ${row.tone}`}
								>
									{row.amount}
								</bdi>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
