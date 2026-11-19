// One card of the task board: the title, a short line on the task, the assignee and the estimate,
// then the priority and the due day under a rule. BoardColumn renders one card per task. A click opens the task dialog.
import { CalendarBlankIcon, UserCircleDashedIcon } from "@phosphor-icons/react";
import {
	fillMessage,
	isOverdue,
	PersonAvatar,
	PriorityBadge,
	pluralOf,
	TASK_KIND_ICON,
	type Task,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";
import { Separator } from "~/shared/ui/separator";

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
		<Card className="relative gap-4 py-5 transition-colors hover:border-ring">
			<CardContent className="grid gap-4 px-5">
				<div className="grid gap-1.5">
					{/* The button covers the whole card through its after: layer, so the card is one target. */}
					<button
						type="button"
						onClick={onOpen}
						className="text-start font-display font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-(--surface-radius) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
						dir="auto"
					>
						{task.title}
					</button>
					<p className="line-clamp-2 text-muted-foreground text-sm">
						{fillMessage(t("board.cardLine"), {
							key: task.key,
							kind: t(`kind.${task.kind}`),
							reporter: task.reporterName,
						})}
					</p>
				</div>
				<div className="flex items-center justify-between gap-2">
					{task.assigneeName ? (
						<span className="flex items-center gap-2 text-sm">
							<PersonAvatar name={task.assigneeName} className="size-7" />
							<span className="truncate">{task.assigneeName}</span>
						</span>
					) : (
						<span className="flex items-center gap-2 text-muted-foreground text-sm">
							<UserCircleDashedIcon className="size-7" />
							{t("task.unassigned")}
						</span>
					)}
					{/* The unit stays visible: a bare number does not read as an estimate. */}
					<span className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-sm tabular-nums">
						<KindIcon className="size-3.5 text-muted-foreground" />
						{fillMessage(t(`board.points.${pluralOf(task.estimate, locale)}`), {
							count: new Intl.NumberFormat(locale).format(task.estimate),
						})}
					</span>
				</div>
				<Separator />
				<div className="flex items-center justify-between gap-2">
					<PriorityBadge priority={task.priority} />
					{task.status !== "done" && task.dueAt !== null ? (
						<span
							className={cn(
								"inline-flex items-center gap-1 text-xs tabular-nums",
								isLate
									? "font-medium text-destructive"
									: "text-muted-foreground",
							)}
						>
							<CalendarBlankIcon className="size-3.5" />
							{isLate ? (
								<span className="sr-only">{t("task.overdue")}</span>
							) : null}
							{shortDate.format(new Date(task.dueAt))}
						</span>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
