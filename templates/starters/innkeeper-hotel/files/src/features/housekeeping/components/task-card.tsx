// One task of the housekeeping board: the room, the kind of work, the attendant, and the time.
// HousekeepingPage renders it in a column. A click opens the room panel of the home page.
import { ClockIcon, LightningIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, initialsOf } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import type { TaskRow } from "../lib/task-board";

type TaskCardProps = {
	/** One task of today with its room and its attendant. */
	task: TaskRow;
};

/** A link with a focus ring. A task with an arrival today shows the rush badge and the arrival time. */
export function TaskCard({ task }: TaskCardProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const minutes = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "minute",
		unitDisplay: "short",
	});
	const isOpen = task.status === "todo" || task.status === "in_progress";

	return (
		<Link
			to="/app"
			search={{ room: Number(task.roomNumber) }}
			className="grid gap-3 rounded-control border bg-background p-3 text-sm outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-control bg-muted font-numeric tabular-nums">
						{task.roomNumber}
					</span>
					<div className="grid min-w-0">
						<span className="truncate font-medium">
							{t(`housekeeping.kinds.${task.kind}`)}
						</span>
						<span className="truncate text-muted-foreground text-xs">
							{t(`roomTypes.${task.roomType}`)}
						</span>
					</div>
				</div>
				{task.status === "blocked" ? (
					<Badge variant="destructive">
						{t("housekeeping.statuses.blocked")}
					</Badge>
				) : task.dueAt && isOpen ? (
					<Badge variant="warning">
						<LightningIcon />
						{t("housekeeping.rush")}
					</Badge>
				) : null}
			</div>
			{task.note ? (
				<p className="text-muted-foreground text-xs" dir="auto">
					{task.note}
				</p>
			) : null}
			<div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
				<span className="flex min-w-0 items-center gap-2">
					<Avatar className="size-6">
						<AvatarFallback className="text-xs">
							{initialsOf(task.attendantName)}
						</AvatarFallback>
					</Avatar>
					<span className="truncate">{task.attendantName}</span>
				</span>
				<span className="flex shrink-0 items-center gap-1 tabular-nums">
					<ClockIcon className="size-3.5" />
					{task.status === "done" && task.doneAt
						? fillMessage(t("housekeeping.doneAt"), {
								time: time.format(new Date(task.doneAt)),
							})
						: task.scheduledAt
							? `${time.format(new Date(task.scheduledAt))} · ${minutes.format(task.durationMinutes)}`
							: minutes.format(task.durationMinutes)}
				</span>
			</div>
			{task.dueAt && isOpen ? (
				<p className="border-t pt-2 text-xs tabular-nums">
					{fillMessage(t("housekeeping.arrivalAt"), {
						time: time.format(new Date(task.dueAt)),
					})}
				</p>
			) : null}
		</Link>
	);
}
