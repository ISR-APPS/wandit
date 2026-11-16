// The rows panel of an entity tab: the newest 8 tasks or open bugs, each with its project, status, and creation time.
// OverviewPage renders it beside the trend of the tab. A click on a row opens the task dialog.
// The footer link opens the project list. The project boards hold every task of the list.
import { Link } from "@tanstack/react-router";
import {
	calendarDaysFromNow,
	formatRelativeTime,
	PriorityMark,
	type Task,
	TaskStatusBadge,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";

type TaskListCardProps = {
	/** The panel title, already translated. */
	title: string;
	/** One muted line under the title. */
	description: string;
	/** At most 8 tasks, in the order to show. */
	tasks: Task[];
	/** The text when the list has no row. */
	emptyText: string;
	/** Runs with the task of the clicked row. */
	onOpenTask: (task: Task) => void;
};

/** Each row is a button: the title and the project on two lines, then the priority, the status, and the creation time. */
export function TaskListCard({
	title,
	description,
	tasks,
	emptyText,
	onOpenTask,
}: TaskListCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const weekdayTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	});
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	// Today reads "3 hours ago". The past week reads "Fri 4:40 PM", because "yesterday" on every row says nothing.
	const createdLabel = (createdAt: string) => {
		const days = -calendarDaysFromNow(createdAt, now);
		if (days === 0) {
			return formatRelativeTime(createdAt, now, locale);
		}
		return (days < 7 ? weekdayTime : shortDate).format(new Date(createdAt));
	};
	return (
		<Card className="gap-4">
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="px-3">
				{tasks.length === 0 ? (
					<p className="px-3 py-8 text-center text-muted-foreground text-sm">
						{emptyText}
					</p>
				) : (
					<ul className="grid">
						{tasks.map((task) => (
							<li key={task.id}>
								<button
									type="button"
									onClick={() => onOpenTask(task)}
									className="relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-control px-3 py-2.5 text-start outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="grid min-w-0 gap-0.5">
										<span className="truncate font-medium text-sm" dir="auto">
											{task.title}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											<span className="tabular-nums">{task.key}</span> ·{" "}
											{task.projectName}
										</span>
									</span>
									<span className="flex items-center gap-3">
										<PriorityMark priority={task.priority} />
										{/* A fixed slot keeps the priority icons in one column, whatever the badge width. */}
										<span className="flex w-24 justify-end max-sm:hidden">
											<TaskStatusBadge status={task.status} />
										</span>
										<span className="w-20 text-end text-muted-foreground text-xs tabular-nums">
											{createdLabel(task.createdAt)}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
			{/* The list shows 8 rows. The project boards show the rest. */}
			<CardFooter className="border-t px-3 pt-2">
				<Link
					to="/app/projects"
					className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 font-medium text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{t("overview.seeBoards")}
					<CaretRightIcon className="size-4 rtl:rotate-180" />
				</Link>
			</CardFooter>
		</Card>
	);
}
