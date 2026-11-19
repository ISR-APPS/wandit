// The follow-up card of the home: the three most urgent open tasks of the team, each in a box.
// DashboardPage renders it in the middle grid. The /app loader fills the open tasks.
// It follows recipe 3.4 of the kit system: a status icon, the title, the deal, a priority badge, and the due text.
// The tasks are read only here, so the icon is not a checkbox. "View all" opens the Activities page.
import {
	ArrowRightIcon,
	CircleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { openTasksQueryOptions } from "~/features/activities";
import {
	formatRelativeTime,
	PriorityBadge,
	taskDueState,
} from "~/features/crm";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

// Three boxes keep the card as tall as the donut card beside it.
const SHOWN_TASKS = 3;

type FollowUpsCardProps = {
	/** The current time in milliseconds since 1970. The due states count from it. */
	now: number;
};

/** The query sorts the most urgent task first, so the first three rows are the most urgent. */
export function FollowUpsCard({ now }: FollowUpsCardProps) {
	const { t, locale } = useT();
	const { data: tasks } = useSuspenseQuery(openTasksQueryOptions());
	const timeOfDay = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tasks.title")}</CardTitle>
				<CardDescription>{t("dashboard.tasksDescription")}</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/activities">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="grid content-start gap-3">
				{tasks.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						{t("dashboard.noTasks")}
					</p>
				) : (
					tasks.slice(0, SHOWN_TASKS).map((task) => {
						const dueState = taskDueState(task.dueAt, now);
						const StateIcon =
							dueState === "overdue" ? WarningCircleIcon : CircleIcon;
						return (
							<div
								key={task.id}
								className="flex items-start gap-3 rounded-md border p-3"
							>
								<StateIcon
									className={cn(
										"mt-0.5 size-4 shrink-0",
										dueState === "overdue"
											? "text-destructive"
											: "text-muted-foreground",
									)}
								/>
								<div className="grid min-w-0 gap-1">
									<p className="font-medium text-sm leading-none">
										{task.title}
									</p>
									<Link
										to="/app/deals/$dealId"
										params={{ dealId: task.deal.id }}
										className="truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
										dir="auto"
									>
										{`${task.deal.name} · ${task.companyName}`}
									</Link>
									<div className="flex flex-wrap items-center gap-2 pt-1">
										<PriorityBadge priority={task.priority} />
										<span
											className={cn(
												"text-xs",
												dueState === "overdue"
													? "text-destructive"
													: "text-muted-foreground",
											)}
										>
											{/* A task of today shows its hour. Other tasks show how far the due day is. */}
											{dueState === "today"
												? `${t("tasks.states.today")} · ${timeOfDay.format(new Date(task.dueAt))}`
												: `${t(`tasks.states.${dueState}`)} · ${formatRelativeTime(task.dueAt, now, locale)}`}
										</span>
									</div>
								</div>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
