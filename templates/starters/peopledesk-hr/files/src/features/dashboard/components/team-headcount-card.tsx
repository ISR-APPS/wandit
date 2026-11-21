// The team card of the home: the net change of the staff in the period, then the people per team as bars.
// DashboardPage renders it last in the middle grid with the summary of the chosen period.
// It follows the bar spark card of recipe 3.8: a signed figure, one context line, and bars with their value on top.
import { lazy, Suspense } from "react";
import { type Department, fillMessage } from "~/features/people";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const TeamBars = lazy(() =>
	import("./team-bars").then((module) => ({ default: module.TeamBars })),
);

type TeamHeadcountCardProps = {
	/** People employed today per department. */
	teams: { department: Department; count: number }[];
	/** People who started in the period. */
	joined: number;
	/** People whose last day passed in the period. */
	left: number;
	/** The period, already formatted, for example "30 days". */
	period: string;
};

/** A net change of 0 shows "0" with no sign and no color, because it is neither good nor bad news. */
export function TeamHeadcountCard({
	teams,
	joined,
	left,
	period,
}: TeamHeadcountCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const net = joined - left;

	return (
		// In the 2-column middle grid of DashboardPage, this card is the full row under the other two.
		<Card className="@2xl/main:col-span-2 @4xl/main:col-span-1">
			<CardHeader>
				<CardTitle>{t("dashboard.teamsTitle")}</CardTitle>
				<CardDescription>{t("dashboard.teamsDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid content-start gap-6">
				<div className="grid gap-1.5">
					{/* dir="ltr" keeps "+2" in this order in an Arabic page. */}
					<bdi
						dir="ltr"
						className="justify-self-start font-numeric font-semibold text-3xl tabular-nums"
					>
						{signed.format(net)}
					</bdi>
					<p className="text-muted-foreground text-xs">
						<span
							className={cn(
								"font-medium",
								net > 0 && "text-success",
								net < 0 && "text-destructive",
							)}
						>
							{fillMessage(t("dashboard.teamsFlow"), {
								joined: number.format(joined),
								left: number.format(left),
							})}
						</span>
						{` ${fillMessage(t("dashboard.inLast"), { period })}`}
					</p>
				</div>
				<Suspense fallback={<Skeleton className="h-56 w-full" />}>
					<TeamBars
						bars={teams.map((team) => ({
							key: team.department,
							label: t(`departments.${team.department}`),
							shortLabel: t(`departmentsShort.${team.department}`),
							value: team.count,
						}))}
					/>
				</Suspense>
			</CardContent>
		</Card>
	);
}
