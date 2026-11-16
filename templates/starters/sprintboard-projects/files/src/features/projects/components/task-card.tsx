// One card of the task board: the key, the priority, the title, the due day, the estimate, and the assignee.
// BoardColumn renders one card per task. A click opens the task dialog of the project page.
import { CalendarBlankIcon, UserCircleDashedIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	isOverdue,
	PersonAvatar,
	PriorityMark,
	pluralOf,
	TASK_KIND_ICON,
	type Task,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type TaskCardProps = {
	task: Task;
	/** The current time in milliseconds since 1970. A due day before it shows in the destructive color. */
	now: number;
	/** Runs when the user opens the card. */
	onOpen: () => void;
};

/** A done card shows no due day: the date has no meaning after the work is done. */
export function TaskCard({ task, now, onOpen }: TaskCardProps) {
	const { t, locale } = useT();
	const KindIcon = TASK_KIND_ICON[task.kind];
	const isLate = isOverdue(task, now);
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<button
			type="button"
			onClick={onOpen}
			// relative: the sr-only texts are absolute. Without it they escape the board and widen the page.
			className="border-(length:--surface-border-width) relative grid w-full gap-2 rounded-surface border-(--surface-border-color) bg-card p-3 text-start shadow-surface outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<KindIcon className="size-3.5" />
				<span className="sr-only">{t(`kind.${task.kind}`)}</span>
				<span className="font-medium tabular-nums">{task.key}</span>
				<span className="ms-auto">
					<PriorityMark priority={task.priority} />
				</span>
			</span>
			<span
				className="line-clamp-2 font-medium text-sm leading-snug"
				dir="auto"
			>
				{task.title}
			</span>
			<span className="flex items-center gap-2 text-xs">
				{task.status !== "done" && task.dueAt !== null ? (
					<span
						className={cn(
							"inline-flex items-center gap-1 tabular-nums",
							isLate ? "font-medium text-destructive" : "text-muted-foreground",
						)}
					>
						<CalendarBlankIcon className="size-3.5" />
						{isLate ? (
							<span className="sr-only">{t("task.overdue")}</span>
						) : null}
						{shortDate.format(new Date(task.dueAt))}
					</span>
				) : null}
				{/* The unit stays visible: a bare number does not read as an estimate. */}
				<span className="rounded-full bg-secondary px-2 py-px font-medium text-secondary-foreground tabular-nums">
					{fillMessage(t(`board.points.${pluralOf(task.estimate, locale)}`), {
						count: new Intl.NumberFormat(locale).format(task.estimate),
					})}
				</span>
				<span className="ms-auto">
					{task.assigneeName ? (
						<>
							<PersonAvatar
								name={task.assigneeName}
								className="size-6 text-[0.625rem]"
							/>
							<span className="sr-only">{task.assigneeName}</span>
						</>
					) : (
						<>
							<UserCircleDashedIcon className="size-6 text-muted-foreground" />
							<span className="sr-only">{t("task.unassigned")}</span>
						</>
					)}
				</span>
			</span>
		</button>
	);
}
