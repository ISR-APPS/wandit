// The wide card of the second band: the engagements of the period's posts, a bar per weekday,
// and three boxed rows for likes, comments, and shares with a thin bar of their share.
// OverviewPage renders it in 8 of 12 columns. "Export" downloads the weekday or the reaction counts as CSV.
import {
	ChatCircleIcon,
	ExportIcon,
	HeartIcon,
	ShareFatIcon,
} from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	ChangePill,
	dayCountFormat,
	downloadCsv,
	fillMessage,
	toCsv,
} from "~/features/social";
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
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import type { EngagementPart, OverviewData } from "../api/overview.queries";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const WeekdayBars = lazy(() =>
	import("./weekday-bars").then((module) => ({ default: module.WeekdayBars })),
);

// The icon of each boxed row.
const PART_ICONS = {
	likes: HeartIcon,
	comments: ChatCircleIcon,
	shares: ShareFatIcon,
} satisfies Record<EngagementPart["id"], typeof HeartIcon>;

// 1 January 2024 is a Monday: the CSV names the weekdays in the order of the chart.
const FIRST_MONDAY_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

type EngagementReportCardProps = {
	report: OverviewData["engagementReport"];
	/** The period of the page, in days. The description names it. */
	days: number;
};

/** The value and the bars sit left of the three boxes from the 3xl container width. */
export function EngagementReportCard({
	report,
	days,
}: EngagementReportCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		timeZone: "UTC",
	});

	function exportWeekdays() {
		const rows = report.byWeekday.map((value, index) => ({
			id: weekday.format(new Date(FIRST_MONDAY_MS + index * DAY_MS)),
			value,
		}));
		downloadCsv(
			"engagements-by-weekday.csv",
			toCsv(rows, [
				{ header: t("overview.report.weekday"), value: (row) => row.id },
				{
					header: t("metrics.engagements"),
					value: (row) => String(row.value),
				},
			]),
		);
	}

	function exportParts() {
		downloadCsv(
			"engagements-by-reaction.csv",
			toCsv(report.parts, [
				{
					header: t("overview.report.reaction"),
					value: (row) => t(`posts.reactions.${row.id}`),
				},
				{ header: t("metrics.engagements"), value: (row) => String(row.value) },
			]),
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.report.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.report.description"), {
						period: dayCountFormat(locale).format(days),
					})}
				</CardDescription>
				<CardAction>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" aria-label={t("overview.export")}>
								<ExportIcon />
								<span className="@4xl/main:inline hidden">
									{t("overview.export")}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={exportWeekdays}>
								{t("overview.report.exportWeekdays")}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={exportParts}>
								{t("overview.report.exportParts")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardAction>
			</CardHeader>
			<CardContent className="grid @3xl/main:grid-cols-2 gap-4">
				<div className="grid content-start gap-4">
					<div className="flex items-center gap-2">
						<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
							{number.format(report.total)}
						</p>
						{report.change === null ? null : (
							<ChangePill change={report.change} goodWhen="up" />
						)}
					</div>
					<Suspense fallback={<Skeleton className="h-60 w-full" />}>
						<WeekdayBars
							values={report.byWeekday}
							seriesLabel={t("metrics.engagements")}
						/>
					</Suspense>
				</div>
				<div className="grid content-start gap-4">
					{report.parts.map((part) => {
						const Icon = PART_ICONS[part.id];
						return (
							<div
								key={part.id}
								className="flex flex-col gap-4 rounded-md border bg-muted p-4"
							>
								<div className="flex items-center justify-between gap-4">
									<div className="flex items-center gap-4">
										<span className="flex size-8 items-center justify-center rounded-md border bg-background">
											<Icon className="size-4" />
										</span>
										<span>{t(`posts.reactions.${part.id}`)}</span>
									</div>
									<span className="font-semibold tabular-nums">
										{number.format(part.value)}
									</span>
								</div>
								<Progress
									value={part.share * 100}
									className="h-1"
									aria-label={`${t(`posts.reactions.${part.id}`)}: ${share.format(part.share)}`}
								/>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
