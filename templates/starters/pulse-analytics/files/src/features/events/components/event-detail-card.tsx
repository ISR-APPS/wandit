// The detail card of the Events page: one event in depth, with its figures, daily volume, top accounts, and platforms.
// EventsPage renders it beside the catalog and gives the chosen event and the period.
// The card reads the detail itself, because the event and the period change after a click.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	DailyAreaChart,
	EventName,
	PanelError,
	type PeriodDays,
	ShareBar,
	shareFormat,
	shareOf,
	TOUCH_AREA,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type CatalogEvent,
	eventDetailQueryOptions,
} from "../api/events.queries";

type EventDetailCardProps = {
	/** The chosen event, with its totals from the catalog. */
	event: CatalogEvent;
	/** The period of the page, in complete days. */
	days: PeriodDays;
};

/** While another event loads, the card keeps the last plot and lists, so it does not jump. */
export function EventDetailCard({ event, days }: EventDetailCardProps) {
	const { t, locale } = useT();
	const detail = useQuery({
		...eventDetailQueryOptions(event.id, days),
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const perPerson = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const share = shareFormat(locale);
	// The list is sorted, so the first account has the largest volume.
	const largestVolume = detail.data?.topAccounts[0]?.volume ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="leading-normal">
					<EventName eventKey={event.id} className="text-sm" />
				</CardTitle>
				<CardDescription>
					{`${t(`areas.${event.area}`)} · ${t(`eventTypes.${event.id}`)}`}
				</CardDescription>
			</CardHeader>
			{/* Beside the catalog the card is narrow: one column. Above the catalog it is wide: the lists sit beside the plot. */}
			<CardContent className="grid @2xl/main:grid-cols-2 @5xl/main:grid-cols-1 grid-cols-1 gap-x-10 gap-y-6">
				<div className="grid content-start gap-6">
					<dl className="grid grid-cols-3 gap-3">
						<div className="grid gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{t("events.columns.volume")}
							</dt>
							<dd className="font-numeric font-semibold text-xl tabular-nums leading-none">
								{number.format(event.volume)}
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{t("events.columns.people")}
							</dt>
							<dd className="font-numeric font-semibold text-xl tabular-nums leading-none">
								{number.format(event.people)}
							</dd>
						</div>
						<div className="grid gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{t("events.detail.perPerson")}
							</dt>
							<dd className="font-numeric font-semibold text-xl tabular-nums leading-none">
								{event.people === 0
									? number.format(0)
									: perPerson.format(event.volume / event.people)}
							</dd>
						</div>
					</dl>
					{detail.isError ? (
						<PanelError
							message={t("events.detail.error")}
							onRetry={() => detail.refetch()}
							className="h-44"
						/>
					) : detail.data === undefined ? (
						<Skeleton className="h-44 w-full" />
					) : event.volume === 0 ? (
						<p className="grid h-44 content-center text-center text-muted-foreground text-sm">
							{t("chart.empty")}
						</p>
					) : (
						<DailyAreaChart
							points={detail.data.points}
							seriesLabel={t("events.detail.series")}
							className="@2xl/main:h-64 @5xl/main:h-44 h-44"
							showYAxis={false}
						/>
					)}
				</div>
				{detail.data === undefined ? (
					detail.isError ? null : (
						<Skeleton className="h-56 w-full" />
					)
				) : (
					<div className="grid content-start gap-6">
						<section className="grid gap-3">
							<h3 className="font-medium font-sans text-sm">
								{t("events.detail.topAccounts")}
							</h3>
							{detail.data.topAccounts.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("events.detail.noAccounts")}
								</p>
							) : (
								<ol className="grid gap-3">
									{detail.data.topAccounts.map((account) => (
										<li key={account.id} className="grid gap-1.5">
											<div className="flex items-baseline gap-3 text-sm">
												<Link
													to="/app/accounts/$accountId"
													params={{ accountId: account.id }}
													className={cn(
														"min-w-0 flex-1 hover:underline",
														TOUCH_AREA,
													)}
												>
													<span className="block truncate">{account.name}</span>
												</Link>
												<span className="text-muted-foreground tabular-nums">
													{number.format(account.volume)}
												</span>
												<span className="w-9 text-end font-medium tabular-nums">
													{share.format(account.share)}
												</span>
											</div>
											{/* The bar compares the account with the first one. The text keeps the share of all events. */}
											<ShareBar
												share={shareOf(account.volume, largestVolume)}
											/>
										</li>
									))}
								</ol>
							)}
						</section>
						<section className="grid gap-3">
							<h3 className="font-medium font-sans text-sm">
								{t("events.detail.platforms")}
							</h3>
							<dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
								{detail.data.platforms.map((platform) => (
									<div
										key={platform.platform}
										className="flex items-baseline justify-between gap-2"
									>
										<dt className="text-muted-foreground">
											{t(`platforms.${platform.platform}`)}
										</dt>
										<dd className="font-medium tabular-nums">
											{share.format(platform.share)}
										</dd>
									</div>
								))}
							</dl>
						</section>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
