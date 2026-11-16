// The first card of the channel list: followers on every account, the 30-day growth, and the share of each channel.
// ChannelsPage renders it before the five channel cards. It reads the same summaries as the cards.
import { CHANNEL_TONES, fillMessage, shareFormat } from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { ChannelSummary } from "../api/channels.queries";

type AllChannelsCardProps = {
	/** The five rows of channelsQueryOptions. */
	summaries: ChannelSummary[];
};

/** The stacked bar holds one segment per channel. The legend under it gives each share as text. */
export function AllChannelsCard({ summaries }: AllChannelsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const signed = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
	const share = shareFormat(locale);
	const followers = summaries.reduce(
		(sum, row) => sum + row.figures.followers,
		0,
	);
	const growth = summaries.reduce((sum, row) => sum + row.figures.netGrowth, 0);

	return (
		<Card className="gap-4 bg-primary/8">
			<CardHeader>
				<CardTitle>{t("channels.allTitle")}</CardTitle>
				<CardDescription>{t("channels.allDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span className="font-numeric text-4xl tabular-nums">
						{number.format(followers)}
					</span>
					<span className="text-muted-foreground text-sm tabular-nums">
						{fillMessage(t("channels.growthLine"), {
							count: signed.format(growth),
						})}
					</span>
				</div>
				<div
					aria-hidden="true"
					className="flex h-3 w-full gap-0.5 overflow-hidden rounded-badge"
				>
					{summaries.map((row) => (
						<span
							key={row.profile.id}
							className={cn("h-full", CHANNEL_TONES[row.profile.id].solid)}
							style={{
								width: `${(row.figures.followers / Math.max(followers, 1)) * 100}%`,
							}}
						/>
					))}
				</div>
				{/* Small gaps keep the longest name ("Video channel") whole at a 1024 px screen. */}
				<ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
					{summaries.map((row) => (
						<li
							key={row.profile.id}
							className="flex items-center justify-between gap-1.5"
						>
							<span className="flex min-w-0 items-center gap-1.5">
								<span
									aria-hidden="true"
									className={cn(
										"size-2 shrink-0 rounded-full",
										CHANNEL_TONES[row.profile.id].solid,
									)}
								/>
								<span className="truncate">
									{t(`channels.names.${row.profile.id}`)}
								</span>
							</span>
							<span className="text-muted-foreground tabular-nums">
								{share.format(row.figures.followers / Math.max(followers, 1))}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
