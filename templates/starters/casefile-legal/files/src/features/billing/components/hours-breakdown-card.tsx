// The logged hours of the last 30 days by practice area, as ranked bars.
// BillingPage renders it beside the hours trend. The rows keep the order of the data: the largest first.
// It follows the breakdown part of the chart form "bars" of the app-dashboard skill.
import { Link } from "@tanstack/react-router";
import {
	type BreakdownSlice,
	fillMessage,
	hoursFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type HoursBreakdownCardProps = {
	/** The parts, already translated, the largest first. */
	slices: BreakdownSlice[];
};

/** The bar behind each name shows the share of the largest part. A long name stays readable in a short bar. */
export function HoursBreakdownCard({ slices }: HoursBreakdownCardProps) {
	const { t, locale } = useT();
	const hours = hoursFormat(locale);
	const largest = Math.max(0, ...slices.map((slice) => slice.value));
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("billing.byAreaTitle")}</CardTitle>
				<CardDescription>{t("billing.byAreaDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{largest === 0 ? (
					<div className="grid h-48 content-center justify-items-center gap-2 text-center text-sm">
						<p className="text-muted-foreground">{t("chart.empty")}</p>
						<Link to="/app/matters" className="underline underline-offset-4">
							{t("chart.breakdownEmptyAction")}
						</Link>
					</div>
				) : (
					<ol className="grid gap-2">
						{slices.map((slice) => (
							<li
								key={slice.label}
								className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm"
							>
								{/* The bar fills only the label cell, so it never runs under the numbers. */}
								<span className="relative flex h-9 min-w-0 items-center px-2.5">
									{/* start-0 makes the bar grow from the start side: from the right in Arabic. */}
									<span
										aria-hidden="true"
										className="absolute inset-y-0 start-0 rounded-sm bg-chart-1/20"
										style={{ width: `${(slice.value / largest) * 100}%` }}
									/>
									<span className="relative truncate">{slice.label}</span>
								</span>
								<span className="flex items-baseline gap-2">
									<span className="font-medium tabular-nums">
										{fillMessage(t("billing.hoursUnit"), {
											hours: hours.format(slice.value),
										})}
									</span>
									<span className="w-9 text-end text-muted-foreground text-xs tabular-nums">
										{percent.format(total > 0 ? slice.value / total : 0)}
									</span>
								</span>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
