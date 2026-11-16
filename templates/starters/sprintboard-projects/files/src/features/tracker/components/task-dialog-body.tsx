// The content of the task dialog: the key, title, status, priority, estimate, people, due day, and steps.
// TaskDialog renders it while a task is open. It reads only the task that it gets.
// The steps come from the four times of the task.
import {
	CheckCircleIcon,
	CircleDashedIcon,
	EyeIcon,
	PlayCircleIcon,
	PlusCircleIcon,
	WarningIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/shared/ui/dialog";
import type { KitIcon } from "~/shared/ui/icons";
import type { Task } from "../api/tasks.queries";
import { TASK_KIND_ICON } from "../lib/codes";
import { fillMessage, pluralOf } from "../lib/format";
import { isOverdue } from "../lib/task-rules";
import { formatRelativeTime } from "../lib/time";
import { PersonAvatar } from "./person-avatar";
import { PriorityMark } from "./priority-mark";
import { TaskStatusBadge } from "./task-status-badge";

type TaskDialogBodyProps = {
	task: Task;
	/** Closes the dialog. The project link calls it before it navigates. */
	onClose: () => void;
};

/** The dialog content of an open task. TaskDialog renders it only while a task is open. */
export function TaskDialogBody({ task, onClose }: TaskDialogBodyProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const KindIcon = TASK_KIND_ICON[task.kind];
	const isLate = isOverdue(task, now);
	const points = new Intl.NumberFormat(locale);
	// The four steps of a task in order. A step that has not happened yet shows "Not yet".
	const steps: { label: string; at: string | null; icon: KitIcon }[] = [
		{
			label: fillMessage(t("task.createdBy"), { name: task.reporterName }),
			at: task.createdAt,
			icon: PlusCircleIcon,
		},
		{ label: t("task.started"), at: task.startedAt, icon: PlayCircleIcon },
		{ label: t("task.inReview"), at: task.reviewAt, icon: EyeIcon },
		{ label: t("task.completed"), at: task.completedAt, icon: CheckCircleIcon },
	];

	return (
		<div className="grid gap-5">
			<DialogHeader className="gap-2 text-start">
				<p className="flex items-center gap-1.5 text-muted-foreground text-sm">
					<KindIcon className="size-4" />
					<span className="font-medium tabular-nums">{task.key}</span>
					<span aria-hidden="true">·</span>
					{t(`kind.${task.kind}`)}
				</p>
				<DialogTitle className="text-start leading-snug" dir="auto">
					{task.title}
				</DialogTitle>
				<DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
					<TaskStatusBadge status={task.status} />
					<PriorityMark priority={task.priority} showLabel />
					<span className="tabular-nums">
						{fillMessage(t(`task.points.${pluralOf(task.estimate, locale)}`), {
							count: points.format(task.estimate),
						})}
					</span>
				</DialogDescription>
			</DialogHeader>

			<dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-surface bg-muted/60 p-4 text-sm sm:grid-cols-2">
				<Fact label={t("task.project")}>
					<Link
						to="/app/projects/$projectId"
						params={{ projectId: task.projectId }}
						onClick={onClose}
						className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
					>
						{task.projectName}
					</Link>
				</Fact>
				<Fact label={t("task.assignee")}>
					{task.assigneeName ? (
						<span className="flex items-center gap-2">
							<PersonAvatar
								name={task.assigneeName}
								className="size-5 text-[0.5625rem]"
							/>
							<bdi>{task.assigneeName}</bdi>
						</span>
					) : (
						<span className="text-muted-foreground">
							{t("task.unassigned")}
						</span>
					)}
				</Fact>
				<Fact label={t("task.due")}>
					{task.dueAt === null ? (
						<span className="text-muted-foreground">{t("task.noDue")}</span>
					) : (
						<span
							className={cn(
								"inline-flex items-center gap-1 tabular-nums",
								isLate && "font-medium text-destructive",
							)}
						>
							{isLate ? <WarningIcon className="size-4" /> : null}
							{date.format(new Date(task.dueAt))}
							{isLate ? (
								<span className="font-normal">
									{`(${formatRelativeTime(task.dueAt, now, locale)})`}
								</span>
							) : null}
						</span>
					)}
				</Fact>
				<Fact label={t("task.reporter")}>
					<bdi>{task.reporterName}</bdi>
				</Fact>
			</dl>

			<section className="grid gap-3">
				<h3 className="font-semibold text-sm">{t("task.history")}</h3>
				<ol className="grid gap-0">
					{steps.map((step, index) => {
						const Icon = step.at ? step.icon : CircleDashedIcon;
						return (
							<li key={step.label} className="flex gap-3">
								<span className="flex flex-col items-center">
									<Icon
										className={cn(
											"size-5 shrink-0",
											step.at ? "text-foreground" : "text-muted-foreground/60",
										)}
									/>
									{index < steps.length - 1 ? (
										<span
											aria-hidden="true"
											className="w-px flex-1 bg-border"
										/>
									) : null}
								</span>
								<span className="grid gap-0.5 pb-4">
									<span
										className={cn(
											"text-sm",
											step.at ? "font-medium" : "text-muted-foreground",
										)}
									>
										{step.label}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{step.at
											? `${dateTime.format(new Date(step.at))} · ${formatRelativeTime(step.at, now, locale)}`
											: t("task.notYet")}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
			</section>
		</div>
	);
}

/** One label and value pair of the facts box. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid gap-1">
			<dt className="label-text text-muted-foreground text-xs">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}
