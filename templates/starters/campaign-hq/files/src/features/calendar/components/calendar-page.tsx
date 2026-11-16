// The content calendar behind login: the month controls, the channel filter, the month grid or the agenda, and the rail.
// The /app/calendar route renders it after its loader. The route also uses the skeleton and the error below.
// The month, the campaign, and the channel live in the URL. The open item and the open day are local state.
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	CHANNELS,
	ChannelMark,
	dayKeyOf,
	fillMessage,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon, XIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { contentItemsQueryOptions } from "../api/calendar.queries";
import { monthCells, monthKeyOf, shiftMonth } from "../lib/month";
import { AgendaList } from "./agenda-list";
import { CalendarRail } from "./calendar-rail";
import { ContentItemDialog } from "./content-item-dialog";
import { DayItemsDialog } from "./day-items-dialog";
import { MonthGrid } from "./month-grid";

const routeApi = getRouteApi("/app/calendar");

// The rail lists this many items that go out next.
const NEXT_COUNT = 5;

/** The filters apply to the grid, the agenda, and the rail. The month buttons stop at the months that have items. */
export function CalendarPage() {
	const { t, locale } = useT();
	const { data: allItems } = useSuspenseQuery(contentItemsQueryOptions());
	const search = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const [openItemId, setOpenItemId] = useState<string | null>(null);
	// The item that the dialog showed last. The dialog keeps it while it fades out.
	const [closingItemId, setClosingItemId] = useState<string | null>(null);
	const [openDay, setOpenDay] = useState<string | null>(null);

	const now = Date.now();
	const today = dayKeyOf(now);
	const month = search.month ?? monthKeyOf(now);
	const firstMonth = monthKeyOf(
		Date.parse(allItems[0]?.scheduledAt ?? "") || now,
	);
	const lastMonth = monthKeyOf(
		Date.parse(allItems.at(-1)?.scheduledAt ?? "") || now,
	);
	const campaignName = allItems.find(
		(item) => item.campaignId === search.campaign,
	)?.campaignName;

	const items = allItems.filter(
		(item) =>
			(!search.channel || item.channel === search.channel) &&
			(!search.campaign || item.campaignId === search.campaign),
	);
	const cells = monthCells(month);
	const itemsByDay = new Map<string, typeof items>();
	for (const item of items) {
		const day = dayKeyOf(Date.parse(item.scheduledAt));
		itemsByDay.set(day, [...(itemsByDay.get(day) ?? []), item]);
	}
	const monthDays = cells
		.filter((cell) => cell.inMonth && itemsByDay.has(cell.day))
		.map((cell) => ({
			day: cell.day,
			startMs: cell.startMs,
			items: itemsByDay.get(cell.day) ?? [],
		}));
	const monthItems = monthDays.flatMap((entry) => entry.items);
	const nextItems = items
		.filter((item) => Date.parse(item.scheduledAt) > now)
		.slice(0, NEXT_COUNT);
	const dialogItem =
		allItems.find((item) => item.id === (openItemId ?? closingItemId)) ?? null;

	const monthTitle = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	}).format(new Date(`${month}-15T12:00:00`));

	function goToMonth(next: string) {
		navigate({
			search: (previous) => ({
				...previous,
				month: next === monthKeyOf(now) ? undefined : next,
			}),
			replace: true,
		});
	}

	function openItem(itemId: string) {
		setOpenDay(null);
		setOpenItemId(itemId);
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("calendar.title")}
				description={t("calendar.description")}
			/>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="max-md:size-11"
						aria-label={t("calendar.previousMonth")}
						disabled={month <= firstMonth}
						onClick={() => goToMonth(shiftMonth(month, -1))}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="max-md:size-11"
						aria-label={t("calendar.nextMonth")}
						disabled={month >= lastMonth}
						onClick={() => goToMonth(shiftMonth(month, 1))}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
					<h2
						className="min-w-40 whitespace-nowrap font-display font-semibold text-lg sm:text-xl"
						aria-live="polite"
					>
						{monthTitle}
					</h2>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="max-md:min-h-11"
						disabled={month === monthKeyOf(now)}
						onClick={() => goToMonth(monthKeyOf(now))}
					>
						{t("calendar.today")}
					</Button>
				</div>
				<fieldset className="flex flex-wrap items-center gap-1.5">
					<legend className="sr-only">{t("calendar.channelFilter")}</legend>
					<Button
						type="button"
						size="sm"
						variant={search.channel ? "outline" : "secondary"}
						aria-pressed={!search.channel}
						className="max-md:min-h-11"
						onClick={() =>
							navigate({
								search: (previous) => ({ ...previous, channel: undefined }),
								replace: true,
							})
						}
					>
						{t("calendar.allChannels")}
					</Button>
					{CHANNELS.map((channel) => (
						<Button
							key={channel}
							type="button"
							size="sm"
							variant={search.channel === channel ? "secondary" : "outline"}
							aria-pressed={search.channel === channel}
							className="max-md:min-h-11"
							onClick={() =>
								navigate({
									search: (previous) => ({ ...previous, channel }),
									replace: true,
								})
							}
						>
							<ChannelMark channel={channel} />
							{t(`channels.${channel}`)}
						</Button>
					))}
				</fieldset>
			</div>
			{campaignName ? (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<span className="rounded-full border bg-accent px-3 py-1 font-medium text-accent-foreground">
						{fillMessage(t("calendar.campaignFilter"), {
							campaign: campaignName,
						})}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="max-md:min-h-11"
						onClick={() =>
							navigate({
								search: (previous) => ({ ...previous, campaign: undefined }),
								replace: true,
							})
						}
					>
						<XIcon />
						{t("calendar.clearCampaign")}
					</Button>
				</div>
			) : null}
			{/* The rail goes beside the month only from 80rem. Narrower, the month cells need the full width. */}
			<div className="grid @7xl/main:grid-cols-[minmax(0,1fr)_17rem] items-start gap-6">
				<Card className="@container/month">
					<CardContent className="grid gap-4">
						{monthItems.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t(
									search.channel ? "calendar.emptyFiltered" : "calendar.empty",
								)}
							</p>
						) : null}
						<div className="@2xl/month:block hidden">
							<MonthGrid
								cells={cells}
								itemsByDay={itemsByDay}
								today={today}
								onOpenItem={openItem}
								onOpenDay={setOpenDay}
							/>
						</div>
						<div className="@2xl/month:hidden">
							{/* The key resets the "earlier items" toggle when the month changes. */}
							<AgendaList
								key={month}
								days={monthDays}
								today={today}
								onOpenItem={openItem}
							/>
						</div>
					</CardContent>
				</Card>
				<CalendarRail
					monthItems={monthItems}
					nextItems={nextItems}
					now={now}
					onOpenItem={openItem}
				/>
			</div>
			<DayItemsDialog
				day={openDay}
				items={openDay ? (itemsByDay.get(openDay) ?? []) : []}
				onOpenChange={(open) => {
					if (!open) {
						setOpenDay(null);
					}
				}}
				onOpenItem={openItem}
			/>
			<ContentItemDialog
				item={dialogItem}
				open={openItemId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setClosingItemId(openItemId);
						setOpenItemId(null);
					}
				}}
			/>
		</div>
	);
}

/** Placeholder while the calendar loader runs. The route sets it as pendingComponent. */
export function CalendarPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80" />
			</div>
			<Skeleton className="h-9 w-full max-w-xl" />
			<div className="grid @7xl/main:grid-cols-[minmax(0,1fr)_17rem] gap-6">
				<Skeleton className="h-[36rem]" />
				<Skeleton className="h-80" />
			</div>
		</div>
	);
}

/** Error state of the calendar when the loader fails. Try again runs the loader again. */
export function CalendarPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("calendar.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
