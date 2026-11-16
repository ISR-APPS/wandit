// The schedule behind login: one week of posts on a board, the weekly goals, and the drafts.
// The /app/schedule route renders it after its loader. The route also uses the skeleton and the error below.
// The week buttons move the board between the oldest listed week and next week. The state is local.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { postsQueryOptions } from "~/features/posts";
import { fillMessage, LoadError, startOfDayAgo } from "~/features/social";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	MAX_WEEK_OFFSET,
	MIN_WEEK_OFFSET,
	weekDays,
	weekStart,
} from "../lib/week";
import { CadenceCard } from "./cadence-card";
import { DraftsCard } from "./drafts-card";
import { WeekBoard } from "./week-board";

/** Week 0 is the current week. A negative offset is a past week. */
export function SchedulePage() {
	const { t, locale } = useT();
	const { data: posts } = useSuspenseQuery(postsQueryOptions());
	const [offset, setOffset] = useState(0);
	const now = Date.now();
	const start = weekStart(now, offset);
	const days = weekDays(posts, start, now);
	const drafts = posts.filter((post) => post.status === "draft");
	const range = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	}).formatRange(start, startOfDayAgo(start, -6));

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("schedule.title")}
				description={fillMessage(t("schedule.description"), { range })}
				actions={
					<>
						<Button
							type="button"
							variant="outline"
							size="icon"
							disabled={offset <= MIN_WEEK_OFFSET}
							onClick={() => setOffset(offset - 1)}
							aria-label={t("schedule.previousWeek")}
						>
							<CaretLeftIcon className="rtl:rotate-180" />
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={offset === 0}
							onClick={() => setOffset(0)}
						>
							{t("schedule.thisWeek")}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							disabled={offset >= MAX_WEEK_OFFSET}
							onClick={() => setOffset(offset + 1)}
							aria-label={t("schedule.nextWeek")}
						>
							<CaretRightIcon className="rtl:rotate-180" />
						</Button>
					</>
				}
			/>
			<WeekBoard days={days} />
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 items-start @3xl/main:gap-6 gap-4">
				<CadenceCard days={days} />
				<DraftsCard drafts={drafts} />
			</div>
		</div>
	);
}

// Fixed keys of the seven placeholder columns.
const SKELETON_DAYS = ["1", "2", "3", "4", "5", "6", "7"];

/** Placeholder while the schedule loader runs. The route sets it as pendingComponent. */
export function SchedulePageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-2">
					<Skeleton className="h-8 w-36" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>
				<Skeleton className="h-9 w-48" />
			</div>
			<div className="grid @4xl/main:grid-cols-7 grid-cols-1 gap-2">
				{SKELETON_DAYS.map((key) => (
					<Skeleton key={key} className="@4xl/main:h-80 h-20" />
				))}
			</div>
			<div className="grid @4xl/main:grid-cols-2 grid-cols-1 gap-4">
				<Skeleton className="h-72" />
				<Skeleton className="h-72" />
			</div>
		</div>
	);
}

/** Error state of the schedule when the loader fails. */
export function SchedulePageError() {
	const { t } = useT();
	return <LoadError message={t("schedule.loadError")} />;
}
