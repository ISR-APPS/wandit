// The recent tasks card of a project page: the six tasks with the newest step, in a small table.
// ProjectDetailPage renders it in the half-width row under the milestones. A title opens the task dialog.
import { type Task, TaskStatusBadge } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";

/** The card shows this many tasks, as the kit history table. */
const SHOWN_TASKS = 6;

// The time of the last step of a task: done, review, start, or creation.
function lastStepAt(task: Task): string {
	return task.completedAt ?? task.reviewAt ?? task.startedAt ?? task.createdAt;
}

type RecentTasksCardProps = {
	/** Every task of the project. */
	tasks: Task[];
	/** Runs with the task of the clicked title. */
	onOpenTask: (task: Task) => void;
};

/** The date column is the day of the last step, so a task just moved to review is near the top. */
export function RecentTasksCard({ tasks, onOpenTask }: RecentTasksCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const recent = [...tasks]
		.sort((first, second) =>
			lastStepAt(second).localeCompare(lastStepAt(first)),
		)
		.slice(0, SHOWN_TASKS);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("project.recentTasks")}</CardTitle>
			</CardHeader>
			<CardContent>
				{recent.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("project.noTasks")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("tasks.titleColumn")}</TableHead>
								<TableHead>{t("tasks.status")}</TableHead>
								<TableHead className="text-end">
									{t("project.lastStep")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{recent.map((task) => (
								<TableRow key={task.id}>
									<TableCell className="max-w-48">
										<button
											type="button"
											onClick={() => onOpenTask(task)}
											className="block w-full truncate text-start hover:underline"
											dir="auto"
										>
											{task.title}
										</button>
									</TableCell>
									<TableCell>
										<TaskStatusBadge status={task.status} />
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{date.format(new Date(lastStepAt(task)))}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
