// The milestones of a project as a short timeline: done, late, or coming, with the due day of each.
// ProjectDetailPage renders it under the board.
import {
	CheckCircleIcon,
	CircleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	formatRelativeTime,
	type MilestoneRow,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type MilestonesCardProps = {
	/** The milestones of the project, the earliest due first. */
	milestones: MilestoneRow[];
};

/** A milestone is late when it is open and its due day has passed. */
export function MilestonesCard({ milestones }: MilestonesCardProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const number = new Intl.NumberFormat(locale);
	const doneCount = milestones.filter(
		(milestone) => milestone.doneAt !== null,
	).length;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("project.milestones")}</CardTitle>
				<CardDescription>
					{fillMessage(t("project.milestonesDone"), {
						done: number.format(doneCount),
						total: number.format(milestones.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{milestones.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("project.noMilestones")}
					</p>
				) : (
					<ol className="grid">
						{milestones.map((milestone, index) => {
							const isDone = milestone.doneAt !== null;
							const isLate = !isDone && Date.parse(milestone.dueAt) < now;
							const Icon = isDone
								? CheckCircleIcon
								: isLate
									? WarningCircleIcon
									: CircleIcon;
							return (
								<li key={milestone.id} className="flex gap-3">
									<span className="flex flex-col items-center">
										<Icon
											className={cn(
												"size-5 shrink-0",
												isDone
													? "text-success"
													: isLate
														? "text-destructive"
														: "text-muted-foreground",
											)}
										/>
										{index < milestones.length - 1 ? (
											<span
												aria-hidden="true"
												className="w-px flex-1 bg-border"
											/>
										) : null}
									</span>
									<span className="grid gap-0.5 pb-4">
										<span className="font-medium text-sm" dir="auto">
											{milestone.name}
										</span>
										<span
											className={cn(
												"text-xs tabular-nums",
												isLate ? "text-destructive" : "text-muted-foreground",
											)}
										>
											{isDone
												? `${t("project.milestoneDone")} · ${date.format(new Date(milestone.doneAt ?? milestone.dueAt))}`
												: `${isLate ? t("project.milestoneLate") : t("project.milestoneDue")} · ${date.format(new Date(milestone.dueAt))} · ${formatRelativeTime(milestone.dueAt, now, locale)}`}
										</span>
									</span>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
