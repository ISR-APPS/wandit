// The follow-up card of the activities page: the open tasks of the team in three tabs by due state.
// ActivitiesPage renders it and passes the cached tasks. A tab filters the list; each task links to its deal.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { Task } from "../api/tasks.queries";
import {
	TASK_DUE_STATES,
	type TaskDueState,
	taskDueState,
} from "../lib/task-due";
import { TaskList } from "./task-list";

type FollowUpsCardProps = {
	/** Every open task of the team, the most urgent first. */
	tasks: Task[];
	/** The current time in milliseconds since 1970. The due states count from it. */
	now: number;
};

/** The first tab with tasks is open at the start: overdue first, then today, then upcoming. */
export function FollowUpsCard({ tasks, now }: FollowUpsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const groups = TASK_DUE_STATES.map((state) => ({
		state,
		tasks: tasks.filter((task) => taskDueState(task.dueAt, now) === state),
	}));
	const firstState =
		groups.find((group) => group.tasks.length > 0)?.state ?? "overdue";
	const [chosenState, setChosenState] = useState<TaskDueState | null>(null);
	const activeState = chosenState ?? firstState;
	const activeTasks =
		groups.find((group) => group.state === activeState)?.tasks ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tasks.title")}</CardTitle>
				<CardDescription>{t("tasks.description")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={activeState}
					onValueChange={(value) =>
						setChosenState(
							TASK_DUE_STATES.find((state) => state === value) ?? null,
						)
					}
					className="max-w-full overflow-x-auto"
				>
					<TabsList className="w-full">
						{groups.map((group) => (
							<TabsTrigger key={group.state} value={group.state}>
								{t(`tasks.states.${group.state}`)}
								<span className="text-muted-foreground tabular-nums">
									{number.format(group.tasks.length)}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{activeTasks.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t(`tasks.empty.${activeState}`)}
					</p>
				) : (
					<TaskList tasks={activeTasks} now={now} showDeal showState={false} />
				)}
			</CardContent>
		</Card>
	);
}
