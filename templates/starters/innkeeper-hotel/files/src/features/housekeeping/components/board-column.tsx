// One column of the housekeeping board: the room state with its count and planned minutes, then its task cards.
// HousekeepingPage renders one column per state, inside a row that scrolls sideways.
// It follows the kanban column of the kit (recipe 3.6).
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type {
	BoardColumn as BoardColumnName,
	TaskRow,
} from "../lib/task-board";
import { TaskCard } from "./task-card";

type BoardColumnProps = {
	column: BoardColumnName;
	/** The tasks of the column, in the order of tasksOfColumn. */
	tasks: TaskRow[];
	/** The current time in milliseconds since 1970, for the progress of the cards. */
	now: number;
};

/** An empty column keeps one dashed slot, so the board keeps its shape. The 4 columns share the width, at least 16rem each. */
export function BoardColumn({ column, tasks, now }: BoardColumnProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const minutes = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "minute",
		unitDisplay: "short",
	});
	const label = t(`housekeeping.columns.${column}`);

	return (
		<section
			aria-label={label}
			className="flex min-w-64 flex-1 basis-0 flex-col gap-3 rounded-surface bg-muted p-3"
		>
			<div className="flex items-center gap-2 px-1">
				<h2 className="font-semibold text-sm">{label}</h2>
				<Badge variant="outline" className="tabular-nums">
					{number.format(tasks.length)}
				</Badge>
				<span className="ms-auto text-muted-foreground text-xs tabular-nums">
					{minutes.format(
						tasks.reduce((sum, task) => sum + task.durationMinutes, 0),
					)}
				</span>
			</div>
			{tasks.length === 0 ? (
				<p className="rounded-surface border border-dashed px-3 py-6 text-center text-muted-foreground text-xs">
					{t(`housekeeping.empty.${column}`)}
				</p>
			) : (
				tasks.map((task) => <TaskCard key={task.id} task={task} now={now} />)
			)}
		</section>
	);
}
