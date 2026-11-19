// The sources card of the home: the sign-ups of the period per channel and their total,
// as six count chips in two columns. OverviewPage renders it first in the row of three small cards.
import { type Channel, fillMessage, shareOf } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type SignUpSourcesCardProps = {
	/** The sign-ups of the period per channel, in the order of CHANNELS. */
	channels: { channel: Channel; signUps: number }[];
};

/** The description names the share of the teammate invites, the largest channel of a team product. */
export function SignUpSourcesCard({ channels }: SignUpSourcesCardProps) {
	const { t, locale } = useT();
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	});
	const total = channels.reduce((sum, item) => sum + item.signUps, 0);
	const invites =
		channels.find((item) => item.channel === "invite")?.signUps ?? 0;
	const chips = [
		...channels.map((item) => ({
			key: item.channel,
			label: t(`overview.sources.short.${item.channel}`),
			value: item.signUps,
		})),
		// The sixth chip is the sum of the five sources, so the grid adds up to the share in the description.
		{ key: "total", label: t("overview.sources.short.total"), value: total },
	];

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("overview.sources.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("overview.sources.description"), {
						share: percent.format(shareOf(invites, total)),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid grid-cols-2 gap-4">
					{chips.map((chip) => (
						<li key={chip.key} className="flex min-w-0 items-center gap-3">
							<Badge
								variant="secondary"
								className="min-w-12 border border-border tabular-nums"
							>
								{compact.format(chip.value)}
							</Badge>
							<span className="min-w-0">{chip.label}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
