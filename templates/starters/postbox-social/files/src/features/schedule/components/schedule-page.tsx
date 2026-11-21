// The schedule, on the layout of the kit "calendar" app: one bordered panel with a toolbar
// (Today, previous and next month, the month name, a view select, Export CSV) and a month grid of post chips.
// The /app/schedule route renders it after the post list loads. The month and the view are state of the page.
// The "List" view shows the same posts of the month as a list by day.
import {
	CaretLeftIcon,
	CaretRightIcon,
	DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { postsQueryOptions } from "~/features/posts";
import {
	CHANNEL_TONES,
	ChannelMark,
	downloadCsv,
	fillMessage,
	LoadError,
	PostStatusBadge,
	toCsv,
} from "~/features/social";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { monthDays, monthStart, type SlotPost } from "../lib/month";

// A day cell shows this many chips. The rest reads "+2 more" and opens the list view.
const CHIPS_PER_DAY = 3;

// 1 January 2024 is a Monday: the weekday row names the days in the order of the grid.
const FIRST_MONDAY_MS = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;

/** The two views of the panel. */
type ScheduleView = "month" | "list";

/** The month moves between the oldest post of the list and the last post of the queue. */
export function SchedulePage() {
	const { t, locale } = useT();
	const { data: posts } = useSuspenseQuery(postsQueryOptions());
	const [offset, setOffset] = useState(0);
	const [view, setView] = useState<ScheduleView>("month");
	const now = Date.now();

	// The post list covers 90 days back and the queue ahead, so the months outside it are empty.
	const slotTimes = posts.flatMap((post) =>
		post.publishAt ? [Date.parse(post.publishAt)] : [],
	);
	const monthsFrom = (time: number) => {
		const date = new Date(time);
		const today = new Date(now);
		return (
			(date.getFullYear() - today.getFullYear()) * 12 +
			date.getMonth() -
			today.getMonth()
		);
	};
	const minOffset = monthsFrom(Math.min(now, ...slotTimes));
	const maxOffset = monthsFrom(Math.max(now, ...slotTimes));

	const start = monthStart(now, offset);
	const days = monthDays(posts, start, now);
	const monthPosts = days
		.filter((day) => day.inMonth)
		.flatMap((day) => day.posts);
	const monthName = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	}).format(new Date(start));
	const weekday = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: "UTC",
	});
	const weekdays = Array.from({ length: 7 }, (_, index) =>
		weekday.format(new Date(FIRST_MONDAY_MS + index * DAY_MS)),
	);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const dayTitle = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

	function exportMonth() {
		downloadCsv(
			`postbox-schedule-${new Date(start).getFullYear()}-${new Date(start).getMonth() + 1}.csv`,
			toCsv(monthPosts, [
				{ header: "ID", value: (post: SlotPost) => post.id },
				{
					header: t("posts.date"),
					value: (post) => dateTime.format(new Date(post.publishAt)),
				},
				{
					header: t("posts.channel"),
					value: (post) => t(`channels.names.${post.channelId}`),
				},
				{ header: t("posts.post"), value: (post) => post.title },
				{
					header: t("posts.status"),
					value: (post) => t(`posts.statuses.${post.status}`),
				},
			]),
		);
	}

	return (
		<Card className="min-h-[calc(100svh-8rem)] gap-0 overflow-hidden py-0">
			<h1 className="sr-only">{t("schedule.title")}</h1>
			<div className="flex flex-wrap items-center justify-between gap-3 p-4">
				<div className="flex items-center gap-1 sm:gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => setOffset(0)}
						disabled={offset === 0}
					>
						{t("schedule.today")}
					</Button>
					<div className="flex items-center">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={t("schedule.previousMonth")}
							disabled={offset <= minOffset}
							onClick={() => setOffset(offset - 1)}
						>
							<CaretLeftIcon className="rtl:rotate-180" />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label={t("schedule.nextMonth")}
							disabled={offset >= maxOffset}
							onClick={() => setOffset(offset + 1)}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Button>
					</div>
					<h2
						className="font-(--heading-weight) font-display text-lg tracking-(--heading-tracking) md:text-xl"
						aria-live="polite"
					>
						{monthName}
					</h2>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={view}
						onValueChange={(value) =>
							setView(value === "list" ? "list" : "month")
						}
					>
						<SelectTrigger aria-label={t("schedule.view")} className="w-auto">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="month">{t("schedule.monthView")}</SelectItem>
							<SelectItem value="list">{t("schedule.listView")}</SelectItem>
						</SelectContent>
					</Select>
					<Button type="button" onClick={exportMonth}>
						<DownloadSimpleIcon />
						<span className="max-sm:sr-only">{t("schedule.exportCsv")}</span>
					</Button>
				</div>
			</div>

			{view === "month" ? (
				<div className="flex-1 overflow-x-auto">
					<div className="grid min-w-180 grid-cols-7">
						{weekdays.map((name) => (
							<div
								key={name}
								className="py-2 text-center text-muted-foreground text-sm"
							>
								{name}
							</div>
						))}
						{days.map((day) => {
							const hidden = day.posts.length - CHIPS_PER_DAY;
							return (
								<div
									key={day.start}
									className={cn(
										"grid min-h-32 content-start gap-1 border-e border-t p-2 [&:nth-child(7n)]:border-e-0",
										!day.inMonth && "bg-muted/40",
									)}
								>
									<span
										className={cn(
											"flex size-6 items-center justify-center rounded-full text-sm tabular-nums",
											day.isToday && "bg-primary text-primary-foreground",
											!day.inMonth && !day.isToday && "text-muted-foreground",
										)}
									>
										{new Date(day.start).getDate()}
									</span>
									{day.posts.slice(0, CHIPS_PER_DAY).map((post) => (
										<Link
											key={post.id}
											to="/app/posts/$postId"
											params={{ postId: post.id }}
											className={cn(
												"block truncate rounded-sm px-2 py-0.5 text-xs hover:opacity-80",
												CHANNEL_TONES[post.channelId].soft,
												post.status === "failed" &&
													"text-destructive line-through",
											)}
											title={`${t(`posts.statuses.${post.status}`)} · ${t(`channels.names.${post.channelId}`)}`}
										>
											<span className="text-muted-foreground tabular-nums">
												{time.format(new Date(post.publishAt))}
											</span>{" "}
											{post.title}
										</Link>
									))}
									{hidden > 0 ? (
										<button
											type="button"
											className="justify-self-start px-2 text-muted-foreground text-xs hover:text-foreground"
											onClick={() => setView("list")}
										>
											{fillMessage(t("schedule.more"), {
												count: String(hidden),
											})}
										</button>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
			) : (
				<div className="border-t">
					{monthPosts.length === 0 ? (
						<p className="p-6 text-muted-foreground text-sm">
							{t("schedule.nothingThisMonth")}
						</p>
					) : (
						<ol className="divide-y">
							{days
								.filter((day) => day.inMonth && day.posts.length > 0)
								.map((day) => (
									<li key={day.start} className="grid gap-2 p-4">
										<h3 className="font-medium text-sm">
											{dayTitle.format(new Date(day.start))}
										</h3>
										<ul className="grid gap-2">
											{day.posts.map((post) => (
												<li
													key={post.id}
													className="flex items-center gap-3 rounded-md border p-3"
												>
													<span className="w-14 shrink-0 text-muted-foreground text-sm tabular-nums">
														{time.format(new Date(post.publishAt))}
													</span>
													<ChannelMark channelId={post.channelId} size="sm" />
													<Link
														to="/app/posts/$postId"
														params={{ postId: post.id }}
														className="min-w-0 flex-1 truncate text-sm hover:underline"
													>
														{post.title}
													</Link>
													<PostStatusBadge status={post.status} />
												</li>
											))}
										</ul>
									</li>
								))}
						</ol>
					)}
				</div>
			)}
		</Card>
	);
}

/** Loading state of the schedule: the toolbar and the month grid. */
export function SchedulePageSkeleton() {
	return <Skeleton className="h-[calc(100svh-8rem)] w-full" />;
}

/** Error state of the schedule when the loader fails. Try again runs the loader again. */
export function SchedulePageError() {
	const { t } = useT();
	return <LoadError message={t("schedule.loadError")} />;
}
