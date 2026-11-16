// The Recent page behind login: the feed of uploads, new versions, shares, and deletes, grouped by day,
// with action tabs, a person filter, and two rail lists for the last 7 days.
// The /app/recent route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	ACTIVITY_ACTIONS,
	type ActivityAction,
	addLocalDays,
	calendarDaysFromNow,
	type FileKind,
	fillCount,
	pluralForm,
} from "~/features/workspace";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { activityQueryOptions, FEED_DAYS } from "../api/activity.queries";
import { groupByDay, rankBy } from "../lib/feed";
import { ActivityEntry } from "./activity-entry";
import { BusyFilesCard } from "./busy-files-card";
import { TopMembersCard } from "./top-members-card";

// The feed opens on 3 days, about 30 entries. "Show earlier days" adds 3 days, up to FEED_DAYS.
const DAYS_STEP = 3;
// The rail lists rank the last week, the same window as the figures of the home.
const RANK_DAYS = 7;
const RANK_LIMIT = 5;

/** The feed page. The person filter applies first; the tabs count what it leaves in the shown days. */
export function RecentPage() {
	const { t, locale } = useT();
	const { data: items } = useSuspenseQuery(activityQueryOptions());
	const [action, setAction] = useState<ActivityAction | "all">("all");
	const [person, setPerson] = useState("all");
	const [shownDays, setShownDays] = useState(DAYS_STEP);

	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const dayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
	const shownStartMs = addLocalDays(now, -(shownDays - 1));
	const people = [...new Set(items.map((item) => item.actorName))].sort(
		(first, second) => first.localeCompare(second, locale),
	);
	const byPerson =
		person === "all"
			? items
			: items.filter((item) => item.actorName === person);
	const inWindow = byPerson.filter(
		(item) => Date.parse(item.at) >= shownStartMs,
	);
	const rows =
		action === "all"
			? inWindow
			: inWindow.filter((item) => item.action === action);
	const days = groupByDay(rows, shownDays, now);

	const rankStartMs = addLocalDays(now, -(RANK_DAYS - 1));
	const topMembers = rankBy(
		items,
		rankStartMs,
		(item) => ({ key: item.actorName, name: item.actorName }),
		RANK_LIMIT,
	);
	const kinds = new Map<string, FileKind>(
		items.map((item) => [item.fileId, item.fileKind]),
	);
	const busyFiles = rankBy(
		items.filter((item) => !item.isInTrash),
		rankStartMs,
		(item) => ({ key: item.fileId, name: item.fileName }),
		RANK_LIMIT,
	);

	function dayLabel(day: string): string {
		const distance = calendarDaysFromNow(`${day}T12:00:00`, now);
		if (distance === 0) {
			return t("recent.today");
		}
		if (distance === -1) {
			return t("recent.yesterday");
		}
		return dayFormat.format(new Date(`${day}T12:00:00`));
	}

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("recent.title")}
				description={t("recent.description")}
			/>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Card className="@5xl/main:col-span-2 min-w-0 gap-4">
					<CardContent className="grid gap-4">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<Tabs
								value={action}
								onValueChange={(value) =>
									setAction(
										ACTIVITY_ACTIONS.find((option) => option === value) ??
											"all",
									)
								}
								className="max-w-full"
							>
								{/* A phone keeps one row of 44 px tall tabs. The row scrolls sideways when it is wider than the card. */}
								<TabsList className="max-sm:max-w-full max-sm:justify-start max-sm:overflow-x-auto max-sm:group-data-[orientation=horizontal]/tabs:h-auto max-sm:[scrollbar-width:none]">
									<TabsTrigger value="all" className="max-sm:min-h-11">
										{t("recent.all")}
										<span className="text-muted-foreground tabular-nums">
											{number.format(inWindow.length)}
										</span>
									</TabsTrigger>
									{ACTIVITY_ACTIONS.map((option) => (
										<TabsTrigger
											key={option}
											value={option}
											className="max-sm:min-h-11"
										>
											{t(`activity.actions.${option}`)}
											<span className="text-muted-foreground tabular-nums">
												{number.format(
													inWindow.filter((item) => item.action === option)
														.length,
												)}
											</span>
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
							<Select value={person} onValueChange={setPerson}>
								<SelectTrigger
									className="w-auto min-w-44"
									aria-label={t("recent.personFilter")}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{t("recent.everyone")}</SelectItem>
									{people.map((name) => (
										<SelectItem key={name} value={name}>
											{name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{days.length === 0 ? (
							<p className="py-10 text-center text-muted-foreground text-sm">
								{t("recent.noResults")}
							</p>
						) : (
							<div className="grid gap-5">
								{days.map((group) => (
									<section
										key={group.day}
										aria-label={dayLabel(group.day)}
										className="grid"
									>
										<h2 className="flex items-baseline justify-between gap-3 border-b pb-2 font-sans font-semibold text-sm">
											{dayLabel(group.day)}
											<span className="font-normal text-muted-foreground text-xs tabular-nums">
												{fillCount(
													t(
														`recent.entryCount.${pluralForm(group.items.length, locale)}`,
													),
													group.items.length,
													locale,
												)}
											</span>
										</h2>
										<ul className="divide-y">
											{group.items.map((item) => (
												<ActivityEntry key={item.id} item={item} />
											))}
										</ul>
									</section>
								))}
							</div>
						)}
						{shownDays < FEED_DAYS ? (
							<Button
								type="button"
								variant="outline"
								className="justify-self-center"
								onClick={() =>
									setShownDays((count) =>
										Math.min(count + DAYS_STEP, FEED_DAYS),
									)
								}
							>
								{t("recent.showEarlier")}
							</Button>
						) : (
							<p className="text-center text-muted-foreground text-xs">
								{fillCount(t("recent.feedLimit"), FEED_DAYS, locale)}
							</p>
						)}
					</CardContent>
				</Card>
				{/* Below 64rem the rail comes first, two cards side by side, so the feed does not push it out of view. */}
				{/* From 64rem the rail is a column that stays in view while the feed scrolls. The plain header does not stick. */}
				<div className="@5xl/main:sticky @5xl/main:top-4 @5xl/main:order-none order-first grid min-w-0 @5xl/main:grid-cols-1 @xl/main:grid-cols-2 gap-6">
					<TopMembersCard title={t("recent.topMembers")} rows={topMembers} />
					<BusyFilesCard
						title={t("recent.busyFiles")}
						rows={busyFiles}
						kindOf={(fileId) => kinds.get(fileId) ?? "document"}
					/>
				</div>
			</div>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7", "8"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function RecentPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-72" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 items-start gap-6">
				<Card className="@5xl/main:col-span-2">
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full sm:max-w-lg" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
				<div className="@5xl/main:order-none order-first grid @5xl/main:grid-cols-1 @xl/main:grid-cols-2 gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-56" />
				</div>
			</div>
		</div>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
export function RecentPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("recent.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
