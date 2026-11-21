// A list of open follow-up tasks: the title, the deal or the rep, the priority, the due time, and the due state when the caller asks for it.
// The Follow-ups tab of the deal page renders it.
import { Link } from "@tanstack/react-router";
import {
	formatRelativeTime,
	PersonAvatar,
	PriorityBadge,
	type TaskDueState,
	taskDueState,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { Task } from "../api/tasks.queries";

/** Badge classes per due state: red for overdue, amber for today, gray for later. They follow the tinted kit variants. */
const DUE_BADGE = {
	overdue:
		"border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/10",
	today: "border-warning/25 bg-warning/12 text-warning hover:bg-warning/12",
	upcoming: "",
} satisfies Record<TaskDueState, string>;

type TaskListProps = {
	/** The tasks to show, the most urgent first. */
	tasks: Task[];
	/** The current time in milliseconds since 1970. The due state and the relative time count from it. */
	now: number;
	/** True shows the deal of each task as a link, and the rep as an avatar. False shows the name of the rep: the deal page already names the deal. */
	showDeal: boolean;
	/** True shows the due state as a badge. False when the caller already cut the list to one state, for example in a tab. */
	showState: boolean;
};

/** One row per task. The caller handles the empty list. */
export function TaskList({ tasks, now, showDeal, showState }: TaskListProps) {
	const { t, locale } = useT();
	const timeOfDay = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<ul className="grid divide-y">
			{tasks.map((task) => {
				const state = taskDueState(task.dueAt, now);
				return (
					// relative: the sr-only name of the rep is absolute, and stays inside its row.
					<li
						key={task.id}
						className="relative flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
					>
						<div className="grid min-w-0 justify-items-start gap-0.5">
							<p className="font-medium text-sm">{task.title}</p>
							{showDeal ? (
								<Link
									to="/app/deals/$dealId"
									params={{ dealId: task.deal.id }}
									className="max-w-full truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
								>
									{`${task.deal.name} · ${task.companyName}`}
								</Link>
							) : (
								<bdi className="text-muted-foreground text-xs">
									{task.assigneeName}
								</bdi>
							)}
						</div>
						<div className="flex shrink-0 items-center gap-2.5">
							<div className="grid justify-items-end gap-1">
								<span className="flex items-center gap-1.5">
									<PriorityBadge priority={task.priority} />
									{showState ? (
										<Badge variant="secondary" className={DUE_BADGE[state]}>
											{t(`tasks.states.${state}`)}
										</Badge>
									) : null}
								</span>
								<time
									dateTime={task.dueAt}
									className="text-muted-foreground text-xs tabular-nums"
								>
									{/* "today" says nothing new beside the badge or the tab, so a task of today shows its hour. */}
									{state === "today"
										? timeOfDay.format(new Date(task.dueAt))
										: formatRelativeTime(task.dueAt, now, locale)}
								</time>
							</div>
							{showDeal ? (
								// The team list shows who must do the task. The title gives the full name on hover.
								<span title={task.assigneeName}>
									<PersonAvatar
										name={task.assigneeName}
										className="size-6 text-[0.625rem]"
									/>
									<span className="sr-only">{task.assigneeName}</span>
								</span>
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
}
