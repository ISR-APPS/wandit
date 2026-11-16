// The "Spend by channel" tile of the home: one row per channel with its spend, its conversions, and a share bar.
// OverviewPage renders it in the first bento row. It follows the breakdown part of the chart form "stacked".
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChannelMark, fillMessage, moneyFormat } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { KPI_DAYS, spendByChannelQueryOptions } from "../api/overview.queries";

type SpendByChannelCardProps = {
	/** The span classes of the bento slot. */
	className?: string;
};

/** The share bar compares each channel with the total spend. The conversions show what the spend bought. */
export function SpendByChannelCard({ className }: SpendByChannelCardProps) {
	const { t, locale } = useT();
	const { data: slices } = useSuspenseQuery(
		spendByChannelQueryOptions(KPI_DAYS),
	);
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const total = slices.reduce((sum, slice) => sum + slice.spend, 0);

	return (
		<Card className={cn("gap-4", className)}>
			<CardHeader>
				<CardTitle>{t("overview.spendByChannel")}</CardTitle>
				<CardDescription>{t("overview.spendByChannelHint")}</CardDescription>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("chart.empty")}
					</p>
				) : (
					<ul className="grid gap-3">
						{slices.map((slice) => {
							const label = t(`channels.${slice.channel}`);
							return (
								<li key={slice.channel} className="grid gap-1.5">
									<div className="flex items-baseline justify-between gap-3 text-sm">
										<span className="flex min-w-0 items-center gap-2">
											<ChannelMark channel={slice.channel} />
											<span className="truncate">{label}</span>
										</span>
										<span className="flex shrink-0 items-baseline gap-2 tabular-nums">
											<span className="text-muted-foreground text-xs">
												{fillMessage(t("overview.channelConversions"), {
													count: number.format(slice.conversions),
												})}
											</span>
											<span className="font-medium">
												{money.format(slice.spend)}
											</span>
										</span>
									</div>
									<Progress
										value={slice.spend}
										max={total}
										aria-label={label}
										className="h-1.5"
									/>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
