// The three small cards of the third band of the home, each in 4 of 12 columns:
// post reach (six counts as badges), average daily impressions (a value over a flush area spark),
// and the video share (two shares over a two-color bar). OverviewPage renders them with the period data.
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react";
import {
	DailyAreaChart,
	fillMessage,
	rateFormat,
	shareFormat,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { OverviewData } from "../api/overview.queries";

type TrendMarkProps = {
	/** Ratio against the previous period. null shows no mark. */
	change: number | null;
};

// The arrow at the end of a small card head: green up, red down. More reach is always good news here.
function TrendMark({ change }: TrendMarkProps) {
	const { t } = useT();
	if (change === null || change === 0) {
		return null;
	}
	return change > 0 ? (
		<TrendUpIcon
			className="size-4 text-success rtl:-scale-x-100"
			aria-label={t("overview.trendUp")}
		/>
	) : (
		<TrendDownIcon
			className="size-4 text-destructive rtl:-scale-x-100"
			aria-label={t("overview.trendDown")}
		/>
	);
}

type ReachSummaryCardProps = {
	summary: OverviewData["reachSummary"];
};

/** Six counts of the period in a 2 x 3 grid of a badge and a label. */
export function ReachSummaryCard({ summary }: ReachSummaryCardProps) {
	const { t, locale } = useT();
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.reach.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.reach.description"), {
						rate: rateFormat(locale).format(summary.engagementRate),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4">
					{summary.items.map((item) => (
						<div key={item.id} className="flex items-center gap-3">
							<Badge
								variant="secondary"
								className="min-w-12 justify-center border border-border tabular-nums"
							>
								{compact.format(item.value)}
							</Badge>
							<span className="truncate">{t(item.labelKey)}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

type DailyImpressionsCardProps = {
	daily: OverviewData["dailyImpressions"];
};

/** The spark has no padding under it: it runs to the bottom edge of the card, as in the kit. */
export function DailyImpressionsCard({ daily }: DailyImpressionsCardProps) {
	const { t, locale } = useT();
	return (
		<Card className="h-full justify-between overflow-hidden pb-0">
			<CardHeader>
				<CardDescription>{t("overview.daily.label")}</CardDescription>
				<p className="mb-4 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{new Intl.NumberFormat(locale).format(daily.average)}
				</p>
				<CardAction>
					<TrendMark change={daily.change} />
				</CardAction>
			</CardHeader>
			<DailyAreaChart
				points={daily.points}
				seriesLabel={t("metrics.impressions")}
				variant="mini"
				color="var(--chart-2)"
				className="h-24"
			/>
		</Card>
	);
}

type FormatSplitCardProps = {
	split: OverviewData["formatSplit"];
};

/** The bar shows the video share first. Each part keeps its word and its percent, never a color alone. */
export function FormatSplitCard({ split }: FormatSplitCardProps) {
	const { t, locale } = useT();
	const total = split.video + split.still;
	const videoShare = total === 0 ? 0 : split.video / total;
	const share = shareFormat(locale);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardDescription>{t("overview.split.label")}</CardDescription>
				<p className="mb-6 font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{new Intl.NumberFormat(locale, {
						notation: "compact",
						maximumFractionDigits: 1,
					}).format(total)}
				</p>
				<CardAction>
					<TrendMark change={split.change} />
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4 divide-x">
					<div className="flex items-center gap-3 text-sm">
						<Badge
							variant="secondary"
							className="min-w-12 justify-center border border-border tabular-nums"
						>
							{share.format(videoShare)}
						</Badge>
						<span className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-chart-1" />
							{t("overview.split.video")}
						</span>
					</div>
					<div className="flex items-center justify-end gap-3 text-sm">
						<Badge
							variant="secondary"
							className="min-w-12 justify-center border border-border tabular-nums"
						>
							{share.format(total === 0 ? 0 : 1 - videoShare)}
						</Badge>
						<span className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-chart-2" />
							{t("overview.split.still")}
						</span>
					</div>
				</div>
				<div
					className="mt-4 flex h-4 overflow-hidden rounded-md bg-muted"
					aria-hidden="true"
				>
					<span
						className="bg-chart-1"
						style={{ width: `${videoShare * 100}%` }}
					/>
					<span
						className="bg-chart-2"
						style={{ width: `${total === 0 ? 0 : (1 - videoShare) * 100}%` }}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
