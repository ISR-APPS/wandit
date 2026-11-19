// The calendar card of the home: a small month grid with a dot on each day with viewings,
// status tabs, and the viewings of the chosen day. OverviewPage renders it beside the active listings.
// The month, the chosen day, and the tab are state of the card. They change no query.

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	addressOf,
	dayNumberOf,
	type ViewingRow,
	ViewingStatusBadge,
} from "~/features/agency";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { viewingsQueryOptions } from "../api/viewings.queries";
import {
	addMonths,
	buildMonthGrid,
	dateOfDay,
	monthStartOf,
	viewingsByDay,
	WEEK_DAYS,
	weekStartOf,
} from "../lib/calendar";

const DAY_TABS = ["all", "toCome", "done"] as const;

/** One tab of the day list. The label is the message `viewings.dayTabs.<tab>`. */
type DayTab = (typeof DAY_TABS)[number];

// Each tab keeps the viewings of its statuses. "All" also keeps the cancelled ones.
const TAB_FILTER = {
	all: () => true,
	toCome: (viewing) =>
		viewing.status === "requested" || viewing.status === "confirmed",
	done: (viewing) =>
		viewing.status === "completed" || viewing.status === "no_show",
} satisfies Record<DayTab, (viewing: ViewingRow) => boolean>;

/** It opens on today, or on the next day with a viewing when today has none. */
export function ViewingsCalendarCard() {
	const { t, locale } = useT();
	const { data: viewings } = useSuspenseQuery(viewingsQueryOptions());
	const days = viewingsByDay(viewings);
	const today = dayNumberOf(Date.now());
	const [selectedDay, setSelectedDay] = useState(() => {
		const nextBusyDay = [...days.keys()]
			.filter((day) => day >= today)
			.sort((a, b) => a - b)[0];
		return days.has(today) ? today : (nextBusyDay ?? today);
	});
	const [monthDay, setMonthDay] = useState(() => monthStartOf(selectedDay));
	const [tab, setTab] = useState<DayTab>("all");
	const grid = buildMonthGrid(monthDay, weekStartOf(locale));
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayOfMonth = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const longDate = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const dayViewings = (days.get(selectedDay) ?? []).filter(TAB_FILTER[tab]);

	return (
		<Card className="gap-0 py-0">
			<div className="grid gap-2 p-4">
				<div className="flex items-center justify-between">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("viewings.previousMonth")}
						onClick={() => setMonthDay((day) => addMonths(day, -1))}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<h2 className="font-medium text-sm">
						{new Intl.DateTimeFormat(locale, {
							month: "long",
							year: "numeric",
						}).format(dateOfDay(monthDay))}
					</h2>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("viewings.nextMonth")}
						onClick={() => setMonthDay((day) => addMonths(day, 1))}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</div>
				<div className="grid grid-cols-7 text-center text-muted-foreground text-xs">
					{grid.slice(0, WEEK_DAYS).map((cell) => (
						<span key={cell.dayNumber} className="py-1">
							{weekday.format(dateOfDay(cell.dayNumber))}
						</span>
					))}
				</div>
				<div className="grid grid-cols-7 gap-1">
					{grid.map((cell) => {
						const isSelected = cell.dayNumber === selectedDay;
						const hasViewings = days.has(cell.dayNumber);
						return (
							<button
								key={cell.dayNumber}
								type="button"
								aria-pressed={isSelected}
								aria-label={longDate.format(dateOfDay(cell.dayNumber))}
								onClick={() => setSelectedDay(cell.dayNumber)}
								className={cn(
									"mx-auto flex size-10 flex-col items-center justify-center gap-0.5 rounded-control text-sm tabular-nums hover:bg-accent",
									cell.isInMonth ? "" : "text-muted-foreground",
									cell.dayNumber === today && "font-semibold",
									isSelected &&
										"bg-primary text-primary-foreground hover:bg-primary",
								)}
							>
								{dayOfMonth.format(dateOfDay(cell.dayNumber))}
								<span
									aria-hidden="true"
									className={cn(
										"size-1 rounded-full",
										hasViewings
											? isSelected
												? "bg-primary-foreground"
												: "bg-primary"
											: "bg-transparent",
									)}
								/>
							</button>
						);
					})}
				</div>
			</div>
			<div className="border-t px-4 pt-4 pb-4">
				<Tabs
					value={tab}
					onValueChange={(value) => {
						const next = DAY_TABS.find((option) => option === value);
						if (next) {
							setTab(next);
						}
					}}
				>
					<TabsList className="w-full">
						{DAY_TABS.map((option) => (
							<TabsTrigger key={option} value={option}>
								{t(`viewings.dayTabs.${option}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>
			<ul className="max-h-56 divide-y overflow-y-auto border-t">
				{dayViewings.length === 0 ? (
					<li className="px-4 py-8 text-center text-muted-foreground text-sm">
						{t("viewings.emptyDay")}
					</li>
				) : (
					dayViewings.map((viewing) => (
						<li key={viewing.id}>
							<Link
								to="/app/listings/$listingId"
								params={{ listingId: viewing.listingId }}
								className="flex items-start gap-3 p-4 hover:bg-muted/50"
							>
								<span className="grid min-w-0 flex-1 gap-1">
									<span
										className="truncate font-medium text-sm leading-none"
										dir="auto"
									>
										{addressOf({
											street: viewing.listingStreet,
											unit: viewing.listingUnit,
										})}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{`${viewing.leadName} · ${viewing.agentName}`}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{time.format(new Date(viewing.startsAt))}
									</span>
								</span>
								<ViewingStatusBadge status={viewing.status} />
							</Link>
						</li>
					))
				)}
			</ul>
		</Card>
	);
}
