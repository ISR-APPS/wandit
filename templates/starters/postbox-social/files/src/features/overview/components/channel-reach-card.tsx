// The list card of the last band: the impressions of each channel in the period, largest first,
// each with its change against the previous period. OverviewPage renders it in 4 of 12 columns.
// "View all" opens the channel list.
import { Link } from "@tanstack/react-router";
import {
	ChannelMark,
	DeltaText,
	dayCountFormat,
	fillMessage,
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
import { CaretRightIcon } from "~/shared/ui/icons";
import type { OverviewData } from "../api/overview.queries";

type ChannelReachCardProps = {
	channels: OverviewData["channels"];
	/** The period of the page, in days. */
	days: number;
};

/** One row per channel: the round channel mark, the name, the change line, and the impressions. */
export function ChannelReachCard({ channels, days }: ChannelReachCardProps) {
	const { t, locale } = useT();
	const compact = new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	});
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.channels.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("period.last"), {
						period: dayCountFormat(locale).format(days),
					})}
				</CardDescription>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<Link to="/app/channels">
							{t("overview.channels.viewAll")}
							<CaretRightIcon className="size-4 rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{channels.map((row) => (
						<li key={row.channelId} className="flex items-center">
							<ChannelMark
								channelId={row.channelId}
								className="size-10 rounded-full"
							/>
							<div className="ms-4 grid min-w-0 gap-1">
								<Link
									to="/app/channels/$channelId"
									params={{ channelId: row.channelId }}
									className="truncate font-medium text-sm leading-none hover:underline"
								>
									{t(`channels.names.${row.channelId}`)}
								</Link>
								<p className="text-muted-foreground text-sm">
									<DeltaText change={row.change} />{" "}
									{t("overview.channels.fromPrevious")}
								</p>
							</div>
							<span className="ms-auto ps-3 font-medium tabular-nums">
								{compact.format(row.impressions)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
