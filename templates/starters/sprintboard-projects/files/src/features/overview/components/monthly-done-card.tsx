// The "Completed by month" card of the home: the tasks done in each of the last three full months, as long bars.
// OverviewPage renders it in the half-width row under the reminders. The bars are plain divs: no chart library.
// The sentence under the title compares the newest month with the month before it.
import { fillMessage } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { MonthTotal } from "../lib/overview-data";

// The newest month has the full primary fill. Older months fade, so the order reads without the labels.
const BAR_FILLS = ["bg-primary", "bg-primary/80", "bg-primary/65"] as const;

type MonthlyDoneCardProps = {
	/** The last 3 full months, the newest first. */
	months: MonthTotal[];
};

/** A bar is as long as its count against the largest month. It keeps a minimum width for its month name. */
export function MonthlyDoneCard({ months }: MonthlyDoneCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const monthName = new Intl.DateTimeFormat(locale, { month: "long" });
	const largest = Math.max(1, ...months.map((month) => month.count));
	const [newest, before] = months;
	const difference = newest && before ? newest.count - before.count : null;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.monthlyTitle")}</CardTitle>
				<CardDescription>
					{difference === null || !newest || !before
						? t("overview.monthlyNote")
						: fillMessage(
								t(
									difference >= 0
										? "overview.monthlyMore"
										: "overview.monthlyFewer",
								),
								{
									count: number.format(Math.abs(difference)),
									month: monthName.format(newest.monthStart),
									previous: monthName.format(before.monthStart),
								},
							)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{months.map((month, index) => (
					<div key={month.monthStart} className="grid gap-2">
						<p className="flex items-baseline gap-1 font-numeric font-semibold text-2xl tabular-nums leading-none">
							{number.format(month.count)}
							<span className="font-normal font-sans text-muted-foreground text-xs">
								{t("overview.tasksUnit")}
							</span>
						</p>
						<div
							className={cn(
								"flex h-8 min-w-24 items-center rounded-md px-2 text-primary-foreground text-xs",
								BAR_FILLS[index] ?? "bg-primary/65",
							)}
							style={{ width: `${(month.count / largest) * 100}%` }}
						>
							{monthName.format(month.monthStart)}
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
