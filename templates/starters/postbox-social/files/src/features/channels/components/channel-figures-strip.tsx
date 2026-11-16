// The four figures of one channel in the period: impressions, engagement rate, net new followers, and posts.
// ChannelDetailPage renders it under the header. One card holds four cells, so it reads as one strip.
import { ChangePill } from "~/features/social";
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { Card } from "~/shared/ui/card";
import type { ChannelFigures } from "../api/channels.queries";

type ChannelFiguresStripProps = {
	figures: ChannelFigures;
};

/** One cell of the strip before formatting. */
type Cell = {
	id: string;
	labelKey: TranslationKey;
	value: number;
	format?: Intl.NumberFormatOptions;
	change: number | null;
};

/** 2 x 2 on a phone, 4 in a row from the 3xl container width. The header names the period. */
export function ChannelFiguresStrip({ figures }: ChannelFiguresStripProps) {
	const { t, locale } = useT();
	const cells: Cell[] = [
		{
			id: "impressions",
			labelKey: "metrics.impressions",
			value: figures.impressions,
			change: figures.impressionsChange,
		},
		{
			id: "rate",
			labelKey: "metrics.engagementRate",
			value: figures.engagementRate,
			// Two decimals, as on the home: a change of a tenth of a point must show in the value.
			format: {
				style: "percent",
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			},
			change: figures.engagementRateChange,
		},
		{
			id: "followers",
			labelKey: "metrics.newFollowers",
			value: figures.netGrowth,
			change: figures.netGrowthChange,
		},
		{
			id: "posts",
			labelKey: "metrics.postsPublished",
			value: figures.posts,
			change: figures.postsChange,
		},
	];
	return (
		<Card className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-0 py-0">
			{cells.map((cell) => (
				<div
					key={cell.id}
					className="grid gap-2 border-border p-5 @3xl/main:[&:not(:last-child)]:border-e [&:nth-child(-n+2)]:border-b @3xl/main:[&:nth-child(-n+2)]:border-b-0 [&:nth-child(odd)]:border-e"
				>
					<span className="label-text text-muted-foreground text-sm">
						{t(cell.labelKey)}
					</span>
					<span className="font-numeric text-2xl tabular-nums">
						{new Intl.NumberFormat(locale, cell.format).format(cell.value)}
					</span>
					{cell.change === null ? (
						<span className="text-muted-foreground text-xs">
							{t("kpi.noComparison")}
						</span>
					) : (
						<span>
							<ChangePill change={cell.change} goodWhen="up" />
						</span>
					)}
				</div>
			))}
		</Card>
	);
}
