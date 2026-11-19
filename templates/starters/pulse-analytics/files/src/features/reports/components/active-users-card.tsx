// The active users card of the Reports page, in the anatomy of the kit two-line chart card: the title,
// a sentence on the change, an export menu, and the lines of this period and the period before.
// ReportsPage renders it at 2 of 3 columns, after the notes card.
import { CaretDownIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	changeRatio,
	type DailyPoint,
	downloadCsv,
	fillMessage,
	toCsv,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { Skeleton } from "~/shared/ui/skeleton";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ActiveUsersLines = lazy(() =>
	import("./active-users-lines").then((module) => ({
		default: module.ActiveUsersLines,
	})),
);

type ActiveUsersCardProps = {
	/** The active users per day of the period, oldest first, with the same day one period earlier. */
	points: DailyPoint[];
	/** The period in days. It names the CSV files. */
	days: number;
};

/** The change compares the sum of the daily figures, so each day of the period counts the same. */
export function ActiveUsersCard({ points, days }: ActiveUsersCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const current = points.reduce((sum, point) => sum + point.current, 0);
	const previous = points.reduce((sum, point) => sum + point.previous, 0);
	const change = changeRatio(current, previous);
	const description =
		change === null
			? t("kpi.noComparison")
			: fillMessage(
					t(
						change > 0
							? "reports.activeUsers.up"
							: change < 0
								? "reports.activeUsers.down"
								: "reports.activeUsers.flat",
					),
					{ change: percent.format(Math.abs(change)) },
				);
	const rows = points.map((point) => ({ id: point.day, ...point }));

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.activeUsers.title")}</CardTitle>
				<CardDescription>{description}</CardDescription>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								aria-label={t("reports.activeUsers.export")}
							>
								<DownloadSimpleIcon />
								<span className="hidden lg:inline">
									{t("reports.activeUsers.export")}
								</span>
								<CaretDownIcon className="text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onSelect={() =>
									downloadCsv(
										`active-users-last-${days}-days.csv`,
										toCsv(rows, [
											{
												header: t("overview.csv.day"),
												value: (row) => row.day,
											},
											{
												header: t("reports.activeUsers.current"),
												value: (row) => String(row.current),
											},
										]),
									)
								}
							>
								{t("reports.activeUsers.exportPeriod")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									downloadCsv(
										`active-users-last-${days}-days-compared.csv`,
										toCsv(rows, [
											{
												header: t("overview.csv.day"),
												value: (row) => row.day,
											},
											{
												header: t("reports.activeUsers.current"),
												value: (row) => String(row.current),
											},
											{
												header: t("reports.activeUsers.previous"),
												value: (row) => String(row.previous),
											},
										]),
									)
								}
							>
								{t("reports.activeUsers.exportBoth")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			{/* A flex column, so the lines grow to the bottom of the card as the kit chart does. */}
			<CardContent className="flex flex-1 flex-col">
				<Suspense
					fallback={<Skeleton className="@2xl/main:min-h-62 min-h-32 flex-1" />}
				>
					<ActiveUsersLines points={points} />
				</Suspense>
			</CardContent>
		</Card>
	);
}
