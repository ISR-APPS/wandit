// The bookings card of the home: the bookings received in the last day, week, or month, split by channel.
// FrontDeskPage renders it at the end of the second row of three. The tabs switch between three splits
// that the summary query already holds, so a tab reads no new data.
// It draws a stacked bar with plain divs, the names and counts under it, and a note on the direct share.
import { InfoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/shared/ui/tooltip";
import {
	CHANNEL_PERIODS,
	type ChannelPeriod,
	type ChannelSplit,
} from "../lib/home-figures";

/** The segment color of each channel, in the order of BOOKING_CHANNELS. */
const SEGMENT_COLORS = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
] as const;

type ChannelCardProps = {
	/** The split of each tab, from the summary query. */
	splits: Record<ChannelPeriod, ChannelSplit>;
};

/** The month tab opens first, as the M tab of the kit. */
export function ChannelCard({ splits }: ChannelCardProps) {
	const { t, locale } = useT();
	const [period, setPeriod] = useState<ChannelPeriod>("month");
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const split = splits[period];
	const total = split.reduce((sum, part) => sum + part.value, 0);
	const direct = split.find((part) => part.channel === "direct")?.value ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("frontDesk.channels.title")}</CardTitle>
				<CardAction>
					<Tabs
						value={period}
						onValueChange={(value) =>
							setPeriod(
								CHANNEL_PERIODS.find((option) => option === value) ?? "month",
							)
						}
					>
						<TabsList>
							{CHANNEL_PERIODS.map((option) => (
								<TabsTrigger
									key={option}
									value={option}
									aria-label={t(`frontDesk.channels.periods.${option}`)}
								>
									{t(`frontDesk.channels.tabs.${option}`)}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex flex-wrap items-baseline gap-x-2">
					<span className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{number.format(total)}
					</span>
					<span className="text-muted-foreground text-sm">
						{t(`frontDesk.channels.received.${period}`)}
					</span>
				</div>
				<Separator />
				{total === 0 ? (
					<div className="flex h-12 items-center justify-center rounded-md bg-muted text-muted-foreground text-sm">
						{t("frontDesk.channels.none")}
					</div>
				) : (
					<div className="flex h-12 w-full overflow-hidden rounded-md">
						{split.map((part, index) =>
							part.value === 0 ? null : (
								<Tooltip key={part.channel}>
									<TooltipTrigger asChild>
										<span
											className={cn(
												"h-full",
												SEGMENT_COLORS[index % SEGMENT_COLORS.length],
											)}
											style={{ width: `${(part.value / total) * 100}%` }}
										/>
									</TooltipTrigger>
									<TooltipContent>
										{`${t(`channels.${part.channel}`)}: ${number.format(part.value)}`}
									</TooltipContent>
								</Tooltip>
							),
						)}
					</div>
				)}
				<ul className="grid grid-cols-2 gap-x-4 gap-y-3">
					{split.map((part, index) => (
						// The second column aligns to the end side, as the two labels under the kit bar.
						<li
							key={part.channel}
							className={cn("grid gap-0.5", index % 2 === 1 && "text-end")}
						>
							<span
								className={cn(
									"flex items-center gap-1.5 text-muted-foreground text-sm",
									index % 2 === 1 && "justify-end",
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										"size-2 shrink-0 rounded-full",
										SEGMENT_COLORS[index % SEGMENT_COLORS.length],
									)}
								/>
								{t(`channels.${part.channel}`)}
							</span>
							<span className="font-numeric font-semibold text-xl tabular-nums">
								{number.format(part.value)}
							</span>
						</li>
					))}
				</ul>
				<p className="flex items-start gap-2 rounded-md border p-3 text-muted-foreground text-sm">
					<InfoIcon className="mt-0.5 size-4 shrink-0" />
					{total === 0
						? t("frontDesk.channels.noteEmpty")
						: fillMessage(t("frontDesk.channels.note"), {
								share: percent.format(direct / total),
							})}
				</p>
			</CardContent>
		</Card>
	);
}
