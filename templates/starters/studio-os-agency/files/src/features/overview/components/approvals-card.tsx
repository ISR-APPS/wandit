// The approvals card of the home: deliverables approved in each of the last three complete months.
// OverviewPage renders it in the third band, next to the reminders. Each bar is a plain div.
import { parseDay } from "~/features/studio";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { MonthCount } from "../lib/overview-data";

// One color per month, so the three bars are easy to tell apart. The text color keeps contrast in light and dark.
const BAR_COLORS = [
	"bg-chart-1 text-primary-foreground",
	"bg-chart-2 text-secondary-foreground",
	"bg-chart-3 text-secondary-foreground",
] as const;

type ApprovalsCardProps = {
	/** The last three complete months, the newest first. */
	months: MonthCount[];
};

/** Each month shows its number, then a bar on a scale shared by the three months. */
export function ApprovalsCard({ months }: ApprovalsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});
	const max = Math.max(...months.map((month) => month.count), 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.approvals.title")}</CardTitle>
				<CardDescription>{t("overview.approvals.description")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{months.map((month, index) => {
					const label = monthName.format(parseDay(month.month));
					return (
						<div key={month.month} className="grid auto-rows-min gap-2">
							<p className="flex items-baseline gap-1 font-numeric font-semibold text-2xl tabular-nums leading-none">
								{number.format(month.count)}
								<span className="font-normal font-sans text-muted-foreground text-xs">
									{t("overview.approvals.unit")}
									<span className="sr-only">{`, ${label}`}</span>
								</span>
							</p>
							{/* The bars share one scale. min-w-fit keeps the month name inside a short bar. */}
							<div className="h-8 w-full" aria-hidden="true">
								<div
									className={`flex h-full min-w-fit items-center whitespace-nowrap rounded-sm px-2 text-xs ${BAR_COLORS[index % BAR_COLORS.length]}`}
									style={{
										width: `${max > 0 ? (month.count / max) * 100 : 0}%`,
									}}
								>
									{label}
								</div>
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
