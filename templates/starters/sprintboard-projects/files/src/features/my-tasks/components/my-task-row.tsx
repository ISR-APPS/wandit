// One row of My tasks: the priority, the key, the title, the project, the status, and the due day or done day.
// MyTasksPage renders one row per task in each group. A click opens the task dialog.
import {
	isOverdue,
	PriorityMark,
	type Task,
	TaskStatusBadge,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type MyTaskRowProps = {
	task: Task;
	/** The current time in milliseconds since 1970. */
	now: number;
	/** Runs when the user opens the row. */
	onOpen: () => void;
};

/** A done task shows its done day. An open task shows its due day, in the destructive color when it is late. */
export function MyTaskRow({ task, now, onOpen }: MyTaskRowProps) {
	const { t, locale } = useT();
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const isLate = isOverdue(task, now);
	const dateText =
		task.completedAt !== null
			? shortDate.format(new Date(task.completedAt))
			: task.dueAt !== null
				? shortDate.format(new Date(task.dueAt))
				: "";
	return (
		<button
			type="button"
			onClick={onOpen}
			className="relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-control px-3 py-2.5 text-start outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<PriorityMark priority={task.priority} />
			<span className="grid min-w-0 gap-0.5">
				<span className="truncate font-medium text-sm" dir="auto">
					{task.title}
				</span>
				<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
					<span className="tabular-nums">{task.key}</span>
					<span aria-hidden="true">·</span>
					<span className="truncate">{task.projectName}</span>
				</span>
			</span>
			<span className="flex items-center gap-3">
				<span className="max-sm:hidden">
					<TaskStatusBadge status={task.status} />
				</span>
				<span
					className={cn(
						"w-14 text-end text-xs tabular-nums",
						isLate ? "font-medium text-destructive" : "text-muted-foreground",
					)}
				>
					{isLate ? (
						<span className="sr-only">{t("task.overdue")} </span>
					) : null}
					{dateText}
				</span>
			</span>
		</button>
	);
}
