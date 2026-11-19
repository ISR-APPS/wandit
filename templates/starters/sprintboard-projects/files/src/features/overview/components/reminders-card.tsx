// The "Reminders" card of the home: the next three open tasks with a due time, as three small cards.
// OverviewPage renders it across the row. It reads the task list from the cache that the /app loader fills.
// It follows the reminder variant of recipe 3.4: a priority dot and word, the due time, the title, and a project tag.
import {
	ArrowRightIcon,
	CheckCircleIcon,
	ListChecksIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	calendarDaysFromNow,
	DAY_MS,
	fillMessage,
	isDueBetween,
	type Task,
	type TaskPriority,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { upcomingTasks } from "../lib/overview-data";

/** The card shows this many reminders. The footer link counts the rest of the week. */
const SHOWN_REMINDERS = 3;

// Urgent and high work takes the destructive dot, medium the warning dot. The word stays beside the dot.
const PRIORITY_DOT = {
	urgent: "bg-destructive",
	high: "bg-destructive",
	medium: "bg-warning",
	low: "bg-muted-foreground",
} satisfies Record<TaskPriority, string>;

type RemindersCardProps = {
	/** Every task with its names, from tasksQueryOptions. */
	tasks: Task[];
	/** The current time in milliseconds since 1970. */
	now: number;
};

/** A task in review shows a green check: the work is done and waits for a reviewer. */
export function RemindersCard({ tasks, now }: RemindersCardProps) {
	const { t, locale } = useT();
	const upcoming = upcomingTasks(tasks, now);
	const shown = upcoming.slice(0, SHOWN_REMINDERS);
	// The same rule as the KPI and the Tasks filter, so the three counts agree.
	const weekCount = tasks.filter((task) =>
		isDueBetween(task, now, now + 7 * DAY_MS),
	).length;
	const otherCount = Math.max(0, weekCount - shown.length);
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="@4xl/main:col-span-2">
			<CardHeader>
				<CardTitle>{t("overview.remindersTitle")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="sm" asChild>
						<Link to="/app/tasks">
							<ListChecksIcon />
							{t("overview.openTasks")}
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{shown.length === 0 ? (
					<p className="py-6 text-center text-muted-foreground text-sm">
						{t("overview.noReminders")}
					</p>
				) : (
					<ul className="grid @3xl/main:grid-cols-3 gap-4">
						{shown.map((task) => (
							<ReminderItem key={task.id} task={task} now={now} />
						))}
					</ul>
				)}
				<div className="flex justify-end">
					<Button
						variant="link"
						className="text-muted-foreground hover:text-primary"
						asChild
					>
						<Link to="/app/tasks">
							{otherCount > 0
								? fillMessage(t("overview.otherReminders"), {
										count: number.format(otherCount),
									})
								: t("overview.allTasks")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

type ReminderItemProps = {
	task: Task;
	now: number;
};

// "Today, 17:00" or "In 3 days, 17:00": a relative day, then the clock time of the due time.
function ReminderItem({ task, now }: ReminderItemProps) {
	const { t, locale } = useT();
	const dueAt = task.dueAt ?? "";
	const relativeDay = new Intl.RelativeTimeFormat(locale, {
		numeric: "auto",
	}).format(calendarDaysFromNow(dueAt, now), "day");
	// "today" starts the line, so its first letter takes a capital.
	const dayText = `${relativeDay.charAt(0).toLocaleUpperCase(locale)}${relativeDay.slice(1)}`;
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
		new Date(dueAt),
	);
	const isInReview = task.status === "in-review";
	return (
		<li className="grid content-start gap-4 rounded-surface border p-6">
			<div className="flex items-center gap-2 font-semibold">
				<span
					aria-hidden="true"
					className={cn("size-2 rounded-full", PRIORITY_DOT[task.priority])}
				/>
				{t(`priority.${task.priority}`)}
				<CheckCircleIcon
					aria-hidden="true"
					className={cn(
						"ms-auto size-4",
						isInReview ? "text-success" : "text-muted-foreground/60",
					)}
				/>
				<span className="sr-only">{t(`status.${task.status}`)}</span>
			</div>
			<p className="text-muted-foreground text-sm">
				<time dateTime={dueAt}>{`${dayText}, ${time}`}</time>
			</p>
			<p className="text-sm" dir="auto">
				{task.title}
			</p>
			<Badge variant="outline">{task.projectName}</Badge>
		</li>
	);
}
