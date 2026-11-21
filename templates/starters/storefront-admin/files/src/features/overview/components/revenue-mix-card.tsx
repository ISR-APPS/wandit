// The "Revenue by month" card of the home: a totals box of the two series, then the grouped bars of 6 months.
// OverviewPage renders it in the second band, beside the revenue trend card.
// The chart file loads with React.lazy. The totals are the sums of the 6 months that the bars show.
import { lazy, Suspense } from "react";
import { moneyFormat } from "~/features/shop";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { MonthRevenue } from "../lib/summary";

const RevenueMixChart = lazy(() =>
	import("./revenue-mix-chart").then((module) => ({
		default: module.RevenueMixChart,
	})),
);

type RevenueMixCardProps = {
	/** The last 6 calendar months, oldest first. The period of the page does not change them. */
	months: MonthRevenue[];
	className?: string;
};

/** The totals box sits beside the title on a wide card and under it on a phone. */
export function RevenueMixCard({ months, className }: RevenueMixCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale, "whole");
	const totals = [
		{
			id: "newCustomers",
			label: t("overview.mix.newCustomers"),
			value: months.reduce((sum, month) => sum + month.newCustomers, 0),
		},
		{
			id: "returningCustomers",
			label: t("overview.mix.returningCustomers"),
			value: months.reduce((sum, month) => sum + month.returningCustomers, 0),
		},
	];

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("overview.mix.title")}</CardTitle>
				{/* col-start-1 keeps the text under the title when the totals box moves under it. */}
				<CardDescription className="col-start-1">
					{t("overview.mix.description")}
				</CardDescription>
				{/* Under the title on a narrow page, at the end of the header from the md width of the page column. */}
				<CardAction className="@lg/main:col-start-2 col-start-1 @lg/main:row-span-2 row-span-1 @lg/main:row-start-1 row-start-3 @lg/main:mt-0 mt-2 justify-self-start @lg/main:justify-self-end">
					<dl className="flex gap-8 rounded-md border p-4">
						{totals.map((total) => (
							<div key={total.id} className="grid gap-2">
								<dt className="text-muted-foreground text-xs">{total.label}</dt>
								<dd className="font-numeric text-2xl tabular-nums leading-none">
									{money.format(total.value)}
								</dd>
							</div>
						))}
					</dl>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Suspense fallback={<Skeleton className="h-64 w-full" />}>
					<RevenueMixChart months={months} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
