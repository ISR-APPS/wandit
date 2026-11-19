// One card of the housekeeping board: the task, the room with its note, the attendant, the progress,
// the priority, the start time, and the planned minutes. HousekeepingPage renders one per task in a column.
// It follows the kanban card of the kit page anatomy (recipe 3.6).
import { ClockIcon, HourglassIcon } from "@phosphor-icons/react";
import { fillMessage, initialsOf } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { Separator } from "~/shared/ui/separator";
import {
	PRIORITY_BADGE,
	priorityOf,
	progressOf,
	type TaskRow,
} from "../lib/task-board";

type TaskCardProps = {
	/** One task of today with its room and its attendant. */
	task: TaskRow;
	/** The current time in milliseconds since 1970. The progress of a task in work counts from it. */
	now: number;
};

/** A blocked task shows its reason as the text, and the "Blocked" badge beside the title. */
export function TaskCard({ task, now }: TaskCardProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const minutes = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "minute",
		unitDisplay: "short",
	});
	const priority = priorityOf(task);
	const progress = progressOf(task, now);
	const roomLine = `${fillMessage(t("housekeeping.room"), { number: task.roomNumber })} · ${t(`roomTypes.${task.roomType}`)}`;

	return (
		<Card className="gap-3 py-4">
			<CardContent className="grid gap-3 px-4">
				<div className="flex items-start justify-between gap-2">
					<p className="font-display font-semibold leading-snug">
						{t(`housekeeping.kinds.${task.kind}`)}
					</p>
					{task.status === "blocked" ? (
						<Badge variant="destructive" className="shrink-0">
							{t("housekeeping.blocked")}
						</Badge>
					) : null}
				</div>
				<p className="line-clamp-2 text-muted-foreground text-sm" dir="auto">
					{task.note ? `${roomLine}. ${task.note}` : roomLine}
				</p>
				<div className="flex items-center justify-between gap-2">
					<span className="flex min-w-0 items-center gap-2">
						<Avatar className="size-7 ring-2 ring-card">
							<AvatarFallback className="bg-muted text-xs">
								{initialsOf(task.attendantName)}
							</AvatarFallback>
						</Avatar>
						<span className="truncate text-muted-foreground text-xs">
							{task.attendantName}
						</span>
					</span>
					<span className="flex items-center gap-2">
						<Progress
							value={progress * 100}
							className="h-1.5 w-16"
							aria-label={t("housekeeping.progress")}
						/>
						<span className="text-muted-foreground text-xs tabular-nums">
							{percent.format(progress)}
						</span>
					</span>
				</div>
				<Separator />
				<div className="flex items-center justify-between gap-2">
					<Badge variant="outline" className={PRIORITY_BADGE[priority]}>
						{t(`housekeeping.priorities.${priority}`)}
					</Badge>
					<span className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
						{task.scheduledAt ? (
							<span className="inline-flex items-center gap-1">
								<ClockIcon className="size-3.5" />
								<span className="sr-only">{t("housekeeping.start")}</span>
								{time.format(new Date(task.scheduledAt))}
							</span>
						) : null}
						<span className="inline-flex items-center gap-1">
							<HourglassIcon className="size-3.5" />
							<span className="sr-only">{t("housekeeping.duration")}</span>
							{minutes.format(task.durationMinutes)}
						</span>
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
