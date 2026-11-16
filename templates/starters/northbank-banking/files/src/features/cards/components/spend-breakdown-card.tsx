// The card spend of the last 30 days by spend group: one split bar, then one row per group.
// CardsPage renders it in its rail with translated labels. It follows the breakdown part of the chart form "compare".
import { Link } from "@tanstack/react-router";
import { type BreakdownSlice, MoneyText } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// One color per part, in order. A sixth part ("other") takes the neutral color.
const PART_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
	"bg-muted-foreground",
];

type SpendBreakdownCardProps = {
	/** The parts in cents, largest first, with translated labels. */
	slices: BreakdownSlice[];
};

/** The rows repeat every value, so the split bar hides from screen readers. */
export function SpendBreakdownCard({ slices }: SpendBreakdownCardProps) {
	const { t, locale } = useT();
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("cards.breakdownTitle")}</CardTitle>
				<CardDescription>
					<MoneyText amountCents={total} withCents={false} />
					{` ${t("cards.breakdownDescription")}`}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{total === 0 ? (
					<>
						<div aria-hidden="true" className="h-2.5 rounded-sm bg-muted" />
						<p className="text-muted-foreground text-sm">
							{t("chart.empty")}{" "}
							<Link
								to="/app/transactions"
								className="underline underline-offset-4"
							>
								{t("chart.breakdownEmptyAction")}
							</Link>
						</p>
					</>
				) : (
					<>
						<div
							aria-hidden="true"
							className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm"
						>
							{slices.map((slice, index) => (
								<span
									key={slice.label}
									className={cn("h-full", PART_COLORS[index])}
									style={{ width: `${(slice.value / total) * 100}%` }}
								/>
							))}
						</div>
						<ul className="grid gap-2.5 text-sm">
							{slices.map((slice, index) => (
								<li key={slice.label} className="flex items-center gap-2.5">
									<span
										aria-hidden="true"
										className={cn(
											"size-2.5 shrink-0 rounded-sm",
											PART_COLORS[index],
										)}
									/>
									<span className="min-w-0 flex-1 truncate">{slice.label}</span>
									<MoneyText amountCents={slice.value} withCents={false} />
									<span className="w-10 text-end text-muted-foreground tabular-nums">
										{percent.format(slice.value / total)}
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
}
