// The weekly goals of the shown week: the posts of each channel (published and scheduled) against its goal.
// SchedulePage renders it under the board. Failed posts do not count: they did not go live.
import {
	CHANNEL_TONES,
	CHANNELS,
	ChannelMark,
	fillMessage,
	ShareBar,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { WeekDay } from "../lib/week";

type CadenceCardProps = {
	/** The seven days of the shown week. */
	days: WeekDay[];
};

/** One row per channel, in the channel order. A met goal gets a green badge. */
export function CadenceCard({ days }: CadenceCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const livePosts = days
		.flatMap((day) => day.posts)
		.filter((post) => post.status !== "failed");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("schedule.cadenceTitle")}</CardTitle>
				<CardDescription>{t("schedule.cadenceDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{CHANNELS.map((channel) => {
						const done = livePosts.filter(
							(post) => post.channelId === channel.id,
						).length;
						return (
							<li
								key={channel.id}
								className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2"
							>
								<ChannelMark channelId={channel.id} size="sm" />
								<div className="flex items-center justify-between gap-3 text-sm">
									<span className="font-medium">
										{t(`channels.names.${channel.id}`)}
									</span>
									<span className="flex items-center gap-2">
										{done >= channel.postsPerWeek ? (
											<Badge variant="success">{t("schedule.goalMet")}</Badge>
										) : null}
										<span className="tabular-nums">
											{fillMessage(t("schedule.cadenceValue"), {
												done: number.format(done),
												goal: number.format(channel.postsPerWeek),
											})}
										</span>
									</span>
								</div>
								<ShareBar
									share={done / channel.postsPerWeek}
									fillClassName={CHANNEL_TONES[channel.id].solid}
									className="col-start-2"
								/>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
