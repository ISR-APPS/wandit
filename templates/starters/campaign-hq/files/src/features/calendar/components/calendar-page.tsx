// The content calendar behind login: one framed panel with the toolbar, then the month grid, the week grid, or the agenda.
// The /app/calendar route renders it after its loader. The route also uses the skeleton and the error below.
// It follows the kit calendar app: Today and the arrows at the start, the view menu and the primary button at the end.
// The view, the month, the week, the campaign, and the channel live in the URL. The open item and the open day are local state.
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	CHANNELS,
	ChannelMark,
	dayKeyOf,
	downloadCsv,
	fillMessage,
	shiftDays,
	toCsv,
} from "~/features/marketing";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon, CaretRightIcon, XIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	type ContentItem,
	contentItemsQueryOptions,
} from "../api/calendar.queries";
import { CALENDAR_VIEWS } from "../lib/calendar-search";
import {
	dayStart,
	monthCells,
	monthKeyOf,
	shiftMonth,
	weekCells,
} from "../lib/month";
import { AgendaList } from "./agenda-list";
import { ContentItemDialog } from "./content-item-dialog";
import { DayItemsDialog } from "./day-items-dialog";
import { MonthGrid } from "./month-grid";

const routeApi = getRouteApi("/app/calendar");

// A month cell shows this many chips. A "+N more" button opens the day dialog for the rest.
const CHIPS_PER_CELL = 3;

// The value of the channel menu for "no channel filter". The URL has no channel then.
const ALL_CHANNELS = "all";

/** The filters apply to every view. The arrows stop at the first and the last month or week that has items. */
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
	const view = search.view ?? "month";
	const month = search.month ?? monthKeyOf(now);
	// The week view shows the week of `?week=`, else the first week of the chosen month, else this week.
	const weekDay = search.week ?? (search.month ? `${search.month}-01` : today);
	const cells = view === "week" ? weekCells(weekDay) : monthCells(month);
	const firstDay = dayKeyOf(Date.parse(allItems[0]?.scheduledAt ?? "") || now);
	const lastDay = dayKeyOf(
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
	const itemsByDay = new Map<string, ContentItem[]>();
	for (const item of items) {
		const day = dayKeyOf(Date.parse(item.scheduledAt));
		itemsByDay.set(day, [...(itemsByDay.get(day) ?? []), item]);
	}
	// The days of the view that have items, for the agenda and the CSV. Days outside the month do not count.
	const shownDays = cells
		.filter((cell) => cell.inMonth && itemsByDay.has(cell.day))
		.map((cell) => ({
			day: cell.day,
			startMs: cell.startMs,
			items: itemsByDay.get(cell.day) ?? [],
		}));
	const shownItems = shownDays.flatMap((entry) => entry.items);
	const dialogItem =
		allItems.find((item) => item.id === (openItemId ?? closingItemId)) ?? null;

	const firstCell = cells[0];
	const lastCell = cells.at(-1);
	const isWeek = view === "week";
	const title =
		isWeek && firstCell && lastCell
			? new Intl.DateTimeFormat(locale, {
					month: "short",
					day: "numeric",
					year: "numeric",
				}).formatRange(new Date(firstCell.startMs), new Date(lastCell.startMs))
			: new Intl.DateTimeFormat(locale, {
					month: "long",
					year: "numeric",
				}).format(new Date(`${month}-15T12:00:00`));
	const hasPrevious = isWeek
		? (firstCell?.day ?? today) > firstDay
		: month > firstDay.slice(0, 7);
	const hasNext = isWeek
		? (lastCell?.day ?? today) < lastDay
		: month < lastDay.slice(0, 7);
	const showsToday = cells.some((cell) => cell.inMonth && cell.day === today);

	function step(delta: 1 | -1) {
		if (isWeek) {
			// Seven days per step: the next or the previous week.
			const next = dayKeyOf(shiftDays(dayStart(weekDay), delta * 7));
			navigate({
				search: (previous) => ({ ...previous, week: next }),
				replace: true,
			});
			return;
		}
		const next = shiftMonth(month, delta);
		navigate({
			search: (previous) => ({
				...previous,
				month: next === monthKeyOf(now) ? undefined : next,
			}),
			replace: true,
		});
	}

	function goToToday() {
		navigate({
			search: (previous) => ({
				...previous,
				month: undefined,
				week: undefined,
			}),
			replace: true,
		});
	}

	function changeView(value: string) {
		const next = CALENDAR_VIEWS.find((option) => option === value);
		if (!next) {
			return;
		}
		// Leaving the week view keeps its month, so the user stays at the same dates.
		const nextMonth = isWeek ? monthKeyOf(dayStart(weekDay)) : month;
		navigate({
			search: (previous) => ({
				...previous,
				view: next === "month" ? undefined : next,
				month: nextMonth === monthKeyOf(now) ? undefined : nextMonth,
				week: undefined,
			}),
			replace: true,
		});
	}

	function openItem(itemId: string) {
		setOpenDay(null);
		setOpenItemId(itemId);
	}

	function exportShown() {
		const dateTime = new Intl.DateTimeFormat(locale, {
			dateStyle: "short",
			timeStyle: "short",
		});
		downloadCsv(
			"content-calendar.csv",
			toCsv(shownItems, [
				{
					header: t("calendar.when"),
					value: (row) => dateTime.format(new Date(row.scheduledAt)),
				},
				{ header: t("calendar.item"), value: (row) => row.title },
				{ header: t("calendar.campaign"), value: (row) => row.campaignName },
				{ header: t("calendar.client"), value: (row) => row.client },
				{
					header: t("calendar.channel"),
					value: (row) => t(`channels.${row.channel}`),
				},
				{
					header: t("calendar.format"),
					value: (row) => t(`contentFormats.${row.format}`),
				},
				{
					header: t("calendar.status"),
					value: (row) => t(`contentStatus.${row.status}`),
				},
				{ header: t("calendar.owner"), value: (row) => row.ownerName },
			]),
		);
	}

	const agenda = (
		// The key resets the "earlier items" toggle when the dates change.
		<AgendaList
			key={`${view}-${cells[0]?.day}`}
			days={shownDays}
			today={today}
			onOpenItem={openItem}
		/>
	);

	return (
		<div className="grid gap-4">
			<h1 className="sr-only">{t("calendar.title")}</h1>
			<section className="@container/month overflow-hidden rounded-surface border bg-card">
				<div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
					<div className="flex min-w-0 items-center gap-1 sm:gap-4">
						<Button
							type="button"
							variant="outline"
							className="max-md:min-h-11"
							disabled={showsToday && search.week === undefined}
							onClick={goToToday}
						>
							{t("calendar.today")}
						</Button>
						<div className="flex items-center">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="max-md:size-11"
								aria-label={t(
									isWeek ? "calendar.previousWeek" : "calendar.previousMonth",
								)}
								disabled={!hasPrevious}
								onClick={() => step(-1)}
							>
								<CaretLeftIcon className="rtl:rotate-180" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="max-md:size-11"
								aria-label={t(
									isWeek ? "calendar.nextWeek" : "calendar.nextMonth",
								)}
								disabled={!hasNext}
								onClick={() => step(1)}
							>
								<CaretRightIcon className="rtl:rotate-180" />
							</Button>
						</div>
						{/* The title wraps in a narrow phone toolbar. A cut title hides the year or the week. */}
						<h2
							className="min-w-0 font-semibold text-base sm:text-xl"
							aria-live="polite"
						>
							{title}
						</h2>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={search.channel ?? ALL_CHANNELS}
							onValueChange={(value) =>
								navigate({
									search: (previous) => ({
										...previous,
										channel: CHANNELS.find((option) => option === value),
									}),
									replace: true,
								})
							}
						>
							<SelectTrigger
								aria-label={t("calendar.channelFilter")}
								className="w-auto gap-2 max-md:min-h-11"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value={ALL_CHANNELS}>
									{t("calendar.allChannels")}
								</SelectItem>
								{CHANNELS.map((channel) => (
									<SelectItem key={channel} value={channel}>
										<ChannelMark channel={channel} />
										{t(`channels.${channel}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={view} onValueChange={changeView}>
							<SelectTrigger
								aria-label={t("calendar.view")}
								className="w-auto gap-2 max-md:min-h-11"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{CALENDAR_VIEWS.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`calendar.views.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							className="max-md:min-h-11"
							disabled={shownItems.length === 0}
							onClick={exportShown}
						>
							<DownloadSimpleIcon />
							{t("common.exportCsv")}
						</Button>
					</div>
				</div>
				{campaignName ? (
					<div className="flex flex-wrap items-center gap-2 border-t px-2 py-2 text-sm sm:px-4">
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
				<div className="border-t">
					{shownItems.length === 0 ? (
						<p className="border-b p-4 text-muted-foreground text-sm">
							{t(
								search.channel || search.campaign
									? "calendar.emptyFiltered"
									: "calendar.empty",
							)}
						</p>
					) : null}
					{view === "agenda" ? (
						<div className="p-4">{agenda}</div>
					) : (
						<>
							{/* Seven columns need 42rem. Narrower, the agenda shows the same days. */}
							<div className="@2xl/month:block hidden">
								<MonthGrid
									cells={cells}
									itemsByDay={itemsByDay}
									today={today}
									chipLimit={isWeek ? undefined : CHIPS_PER_CELL}
									onOpenItem={openItem}
									onOpenDay={setOpenDay}
								/>
							</div>
							<div className="@2xl/month:hidden p-4">{agenda}</div>
						</>
					)}
				</div>
			</section>
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
		<div className="grid gap-0 overflow-hidden rounded-surface border bg-card">
			<div className="flex items-center justify-between gap-4 p-4">
				<Skeleton className="h-9 w-72" />
				<Skeleton className="h-9 w-64" />
			</div>
			<Skeleton className="m-4 mt-0 h-[36rem]" />
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
