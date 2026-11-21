// The channel card of the home: the new tickets of the period by channel, as a donut with a legend.
// DashboardPage renders it in the middle grid with the summary of the chosen period.
// The donut file loads with React.lazy. "Export" downloads the counts of every channel as CSV.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import {
	type BreakdownSlice,
	downloadCsv,
	type TicketChannel,
	toCsv,
} from "~/features/helpdesk";
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
import { Skeleton } from "~/shared/ui/skeleton";
import type { ChannelSlice } from "./channel-donut";

// The chart file holds the chart library. A lazy import keeps it out of the first script of the app.
const ChannelDonut = lazy(() =>
	import("./channel-donut").then((module) => ({
		default: module.ChannelDonut,
	})),
);

type ChannelCardProps = {
	/** The new tickets of the period per channel, largest first. One entry per channel, also at 0. */
	channels: BreakdownSlice<TicketChannel>[];
};

/** The legend names each slice and its count, so the color is never the only mark. */
export function ChannelCard({ channels }: ChannelCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const total = channels.reduce((sum, channel) => sum + channel.value, 0);
	const slices: ChannelSlice[] = channels.map((channel, index) => ({
		key: channel.label,
		label: t(`tickets.channels.${channel.label}`),
		value: channel.value,
		// The 4 channels take the chart series 1 to 4, the largest first.
		color: `var(--chart-${index + 1})`,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.channelsTitle")}</CardTitle>
				<CardDescription>{t("dashboard.channelsDescription")}</CardDescription>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							downloadCsv(
								"tickets-by-channel.csv",
								toCsv(
									channels.map((channel) => ({
										id: channel.label,
										...channel,
									})),
									[
										{
											header: t("tickets.channel"),
											value: (row) => t(`tickets.channels.${row.label}`),
										},
										{
											header: t("dashboard.newTickets"),
											value: (row) => String(row.value),
										},
									],
								),
							)
						}
					>
						<DownloadSimpleIcon />
						{t("common.export")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-6">
				<Suspense
					fallback={<Skeleton className="mx-auto size-56 rounded-full" />}
				>
					<ChannelDonut slices={slices} total={total} />
				</Suspense>
				<ul className="flex justify-around gap-2">
					{slices.map((slice) => (
						<li key={slice.key} className="grid min-w-0 gap-1">
							<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span
									aria-hidden="true"
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: slice.color }}
								/>
								<span className="truncate">{slice.label}</span>
							</span>
							<span className="ms-3.5 font-numeric font-semibold text-lg tabular-nums">
								{number.format(slice.value)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
