// The milestones of a project as a line timeline: an icon dot, the name with a state badge, the day, and a relative time.
// ProjectDetailPage renders it first in the 2/3 column of the Overview tab. "View board" opens the Board tab.
import {
	CheckCircleIcon,
	ClockIcon,
	FlagBannerIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	type MilestoneRow,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type MilestonesCardProps = {
	/** The id of the project, for the board link. */
	projectId: string;
	/** The checkpoints, the earliest due first. */
	milestones: MilestoneRow[];
	/** The current time in milliseconds since 1970. */
	now: number;
};

/** The first open milestone is "Next". An open milestone past its due day is "Late". */
export function MilestonesCard({
	projectId,
	milestones,
	now,
}: MilestonesCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const nextId = milestones.find((milestone) => milestone.doneAt === null)?.id;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("project.milestones")}</CardTitle>
				<CardAction>
					<Link
						to="/app/projects/$projectId"
						params={{ projectId }}
						search={{ tab: "board" }}
						className="text-muted-foreground text-sm hover:text-primary hover:underline"
					>
						{t("project.viewBoard")}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className="ps-9">
				{milestones.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("project.noMilestones")}
					</p>
				) : (
					<ol className="relative grid gap-8 border-s">
						{milestones.map((milestone) => {
							const isDone = milestone.doneAt !== null;
							const isLate = !isDone && Date.parse(milestone.dueAt) < now;
							const Icon = isDone ? CheckCircleIcon : FlagBannerIcon;
							const at = milestone.doneAt ?? milestone.dueAt;
							return (
								<li key={milestone.id} className="ms-6 grid gap-2">
									<span className="absolute -start-3 flex size-6 items-center justify-center rounded-full bg-muted ring-8 ring-card">
										<Icon
											className={cn(
												"size-3.5",
												isDone ? "text-success" : "text-primary",
											)}
										/>
									</span>
									<h3 className="flex flex-wrap items-center gap-2 font-semibold">
										<span dir="auto">{milestone.name}</span>
										{isDone ? (
											<Badge variant="success">
												{t("project.milestoneDone")}
											</Badge>
										) : isLate ? (
											<Badge
												variant="outline"
												className="border-destructive/25 bg-destructive/12 text-destructive"
											>
												{t("project.milestoneLate")}
											</Badge>
										) : milestone.id === nextId ? (
											<Badge variant="outline">
												{t("project.milestoneNext")}
											</Badge>
										) : null}
									</h3>
									<p className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none">
										<ClockIcon className="size-3.5" />
										<time dateTime={at}>
											{fillMessage(
												t(isDone ? "project.doneOn" : "project.dueOn"),
												{ date: date.format(new Date(at)) },
											)}
										</time>
									</p>
									<p className="text-muted-foreground text-sm">
										{formatRelativeTime(at, now, locale)}
									</p>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
