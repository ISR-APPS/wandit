// The Board tab of a project page: a search field, a "Filters" menu of assignees, and one column per task status.
// ProjectDetailPage renders it. The filters are local state; buildBoard sorts the filtered tasks during render.
// The board scrolls sideways inside its own box, never the page.
import { FadersHorizontalIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
	dayCountFormat,
	fillMessage,
	type Member,
	type Task,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { CheckIcon, MagnifyingGlassIcon } from "~/shared/ui/icons";
import { Input } from "~/shared/ui/input";
import { buildBoard, DONE_WINDOW_DAYS } from "../lib/board";
import { BoardColumn } from "./board-column";

// The assignee filter value for "nobody". null means "everyone".
const UNASSIGNED = "unassigned";

type ProjectBoardProps = {
	/** Every task of the project. */
	tasks: Task[];
	/** The members of the project, for the assignee filter. */
	members: Member[];
	/** The current time in milliseconds since 1970. */
	now: number;
	/** Runs with the task of the opened card. */
	onOpenTask: (task: Task) => void;
};

/** A new filter folds every column again, through the column key. */
export function ProjectBoard({
	tasks,
	members,
	now,
	onOpenTask,
}: ProjectBoardProps) {
	const { t, locale } = useT();
	const [query, setQuery] = useState("");
	const [assignee, setAssignee] = useState<string | null>(null);
	const needle = query.trim().toLocaleLowerCase(locale);
	const shownTasks = tasks.filter(
		(task) =>
			(assignee === null ||
				(assignee === UNASSIGNED
					? task.assigneeId === null
					: task.assigneeId === assignee)) &&
			(needle === "" ||
				`${task.key} ${task.title}`.toLocaleLowerCase(locale).includes(needle)),
	);
	const board = buildBoard(shownTasks, now);
	const options = [
		...members.map((member) => ({ value: member.id, label: member.name })),
		{ value: UNASSIGNED, label: t("task.unassigned") },
	];
	const chosen = options.find((option) => option.value === assignee);

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<p className="me-auto text-muted-foreground text-sm">
					{fillMessage(t("board.doneNote"), {
						period: dayCountFormat(locale).format(DONE_WINDOW_DAYS),
					})}
				</p>
				<div className="relative w-full sm:w-56">
					<MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={t("board.search")}
						aria-label={t("board.search")}
						className="ps-8"
					/>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline">
							<FadersHorizontalIcon />
							{t("board.filters")}
							{chosen ? (
								<Badge variant="secondary" className="max-w-32 truncate">
									{chosen.label}
								</Badge>
							) : null}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="max-h-80 min-w-52">
						<DropdownMenuLabel>{t("board.assignee")}</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{options.map((option) => {
							const isChosen = option.value === assignee;
							return (
								<DropdownMenuItem
									key={option.value}
									role="menuitemradio"
									aria-checked={isChosen}
									onSelect={() => setAssignee(isChosen ? null : option.value)}
								>
									<CheckIcon
										className={cn("size-4", isChosen ? "" : "invisible")}
									/>
									{option.label}
								</DropdownMenuItem>
							);
						})}
						{chosen ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onSelect={() => setAssignee(null)}>
									{t("table.clearFilter")}
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="flex items-start gap-4 overflow-x-auto pb-2">
				{board.map((column) => (
					<BoardColumn
						key={`${column.status}:${assignee ?? ""}:${needle}`}
						column={column}
						now={now}
						onOpenTask={onOpenTask}
					/>
				))}
			</div>
		</div>
	);
}
