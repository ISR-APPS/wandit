// The formats of one channel ranked by engagement rate over the last 90 days, with the count of posts of each.
// ChannelDetailPage renders it in the rail. A format with no post in 90 days sits last with no bar.
import {
	CHANNEL_TONES,
	type ChannelId,
	fillMessage,
	rateFormat,
	ShareBar,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { FormatScore } from "../api/channels.queries";

type ChannelFormatsCardProps = {
	channelId: ChannelId;
	/** The formats of the channel, the best engagement rate first. */
	formats: FormatScore[];
};

/** The bar width is the rate over the best rate, so the first format always fills its bar. */
export function ChannelFormatsCard({
	channelId,
	formats,
}: ChannelFormatsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const rate = rateFormat(locale);
	const best = Math.max(...formats.map((row) => row.engagementRate), 0.0001);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("channels.formatsTitle")}</CardTitle>
				<CardDescription>{t("channels.formatsDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{formats.map((row) => (
						<li key={row.format} className="grid gap-2">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="font-medium">
									{t(`formats.${row.format}`)}
								</span>
								<span className="flex items-baseline gap-3">
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(t("channels.formatPosts"), {
											count: number.format(row.posts),
										})}
									</span>
									<span className="w-12 text-end tabular-nums">
										{row.posts === 0 ? "–" : rate.format(row.engagementRate)}
									</span>
								</span>
							</div>
							<ShareBar
								share={row.engagementRate / best}
								fillClassName={CHANNEL_TONES[channelId].solid}
							/>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
