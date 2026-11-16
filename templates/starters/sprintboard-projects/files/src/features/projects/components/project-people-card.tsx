// The people of a project with their open work in this project: open tasks (backlog included) and committed story points.
// ProjectDetailPage renders it under the board. The lead comes first and carries a "Lead" badge.
import {
	fillMessage,
	isCommitted,
	type Member,
	PersonAvatar,
	pluralOf,
	type Task,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ProjectPeopleCardProps = {
	/** The members of the project, the lead first. */
	members: Member[];
	/** The id of the project lead. */
	leadId: string;
	/** Every task of the project. The card counts the open ones per person. */
	tasks: Task[];
	/** Tasks of the project that nobody owns yet. */
	unassignedCount: number;
};

/** The figures count only this project. The Team page shows the load of each person across projects. */
export function ProjectPeopleCard({
	members,
	leadId,
	tasks,
	unassignedCount,
}: ProjectPeopleCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("project.people")}</CardTitle>
				<CardDescription>
					{unassignedCount > 0
						? fillMessage(t("project.unassigned"), {
								count: number.format(unassignedCount),
							})
						: t("project.allAssigned")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="grid divide-y">
					{members.map((member) => {
						const open = tasks.filter(
							(task) => task.assigneeId === member.id && task.status !== "done",
						);
						const points = open
							.filter((task) => isCommitted(task.status))
							.reduce((sum, task) => sum + task.estimate, 0);
						return (
							<li
								key={member.id}
								className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
							>
								<PersonAvatar name={member.name} />
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="flex items-center gap-2 font-medium text-sm">
										<bdi className="truncate">{member.name}</bdi>
										{member.id === leadId ? (
											<Badge variant="secondary">{t("project.lead")}</Badge>
										) : null}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{member.role}
									</span>
								</span>
								<span className="grid justify-items-end text-sm">
									<span className="font-medium tabular-nums">
										{fillMessage(t("project.openCount"), {
											count: number.format(open.length),
										})}
									</span>
									{/* Committed points leave out the backlog, so the label names them: "3 open" can have "0 points committed". */}
									<span className="text-muted-foreground text-xs tabular-nums">
										{fillMessage(
											t(`project.committed.${pluralOf(points, locale)}`),
											{ count: number.format(points) },
										)}
									</span>
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
