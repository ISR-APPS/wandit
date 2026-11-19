// The figure list card of the last band: six figures of the period, each with an icon tile,
// its value, and an outline badge with its change. OverviewPage renders it in 4 of 12 columns.
import {
	ChatCircleIcon,
	CursorClickIcon,
	EyeIcon,
	HeartIcon,
	LightningIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { DeltaText, fillMessage } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { OverviewFigure } from "../api/overview.queries";

// The icon of each summary figure, by figure id. An unknown id gets the lightning icon.
const SUMMARY_ICONS: Record<string, KitIcon> = {
	impressions: EyeIcon,
	engagements: LightningIcon,
	"new-followers": UserPlusIcon,
	likes: HeartIcon,
	comments: ChatCircleIcon,
	clicks: CursorClickIcon,
};

type PeriodSummaryCardProps = {
	summary: OverviewFigure[];
	/** Engagements of all channels in the period, for the description. */
	engagements: number;
	/** The number of connected channels, for the description. */
	channelCount: number;
};

/** One row per figure. The change badge colors good news green and bad news red. */
export function PeriodSummaryCard({
	summary,
	engagements,
	channelCount,
}: PeriodSummaryCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.summary.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.summary.description"), {
						count: compact.format(engagements),
						channels: number.format(channelCount),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{summary.map((figure) => {
						const Icon = SUMMARY_ICONS[figure.id] ?? LightningIcon;
						return (
							<li key={figure.id} className="flex items-center">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
									<Icon className="size-4" />
								</span>
								<span className="ms-4 truncate">{t(figure.labelKey)}</span>
								<div className="ms-auto flex items-center gap-3 ps-3">
									<span className="text-sm tabular-nums">
										{compact.format(figure.value)}
									</span>
									<span className="w-16 text-end">
										<Badge variant="outline">
											<DeltaText
												change={figure.change}
												goodWhen={figure.goodWhen}
											/>
										</Badge>
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
