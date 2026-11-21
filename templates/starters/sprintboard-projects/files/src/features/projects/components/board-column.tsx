// One column of the task board: the status with its count, then the cards of its tasks.
// ProjectBoard renders one column per status. The column holds its own "Show N more" state.
import { useState } from "react";
import { fillMessage, type Task } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	type BoardColumn as BoardColumnData,
	COLUMN_CARDS,
} from "../lib/board";
import { TaskCard } from "./task-card";

type BoardColumnProps = {
	column: BoardColumnData;
	/** The current time in milliseconds since 1970. The cards mark late tasks from it. */
	now: number;
	/** Runs with the task of the opened card. */
	onOpenTask: (task: Task) => void;
};

/** A column shows its first COLUMN_CARDS cards. "Show N more" opens the rest in place. */
export function BoardColumn({ column, now, onOpenTask }: BoardColumnProps) {
	const { t, locale } = useT();
	const [isExpanded, setIsExpanded] = useState(false);
	const number = new Intl.NumberFormat(locale);
	const shown = isExpanded ? column.tasks : column.tasks.slice(0, COLUMN_CARDS);
	const hiddenCount = column.tasks.length - shown.length;
	return (
		<section
			aria-label={t(`status.${column.status}`)}
			className="flex w-80 shrink-0 flex-col gap-3 rounded-surface bg-muted p-3"
		>
			<div className="flex items-center gap-2 px-1">
				<h3 className="font-semibold text-sm">
					{t(`status.${column.status}`)}
				</h3>
				<Badge variant="outline" className="tabular-nums">
					{number.format(column.tasks.length)}
				</Badge>
			</div>
			{column.tasks.length === 0 ? (
				// An empty column keeps one slot, so the board keeps its shape.
				<p className="rounded-surface border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
					{t("board.emptyColumn")}
				</p>
			) : (
				shown.map((task) => (
					<TaskCard
						key={task.id}
						task={task}
						now={now}
						onOpen={() => onOpenTask(task)}
					/>
				))
			)}
			{hiddenCount > 0 ? (
				<button
					type="button"
					onClick={() => setIsExpanded(true)}
					className="min-h-9 rounded-control px-1.5 py-1 text-start text-muted-foreground text-sm underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{fillMessage(t("board.showMore"), {
						count: number.format(hiddenCount),
					})}
				</button>
			) : null}
		</section>
	);
}
