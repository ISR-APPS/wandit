// The people card of a project page: each member with the role and the open tasks in this project.
// ProjectDetailPage renders it beside the recent tasks card. The end button opens the Team page.
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	type Member,
	PersonAvatar,
	type Task,
} from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
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
};

/** The lead carries a "Lead" badge. The counts take only this project; the Team page shows the whole load. */
export function ProjectPeopleCard({
	members,
	leadId,
	tasks,
}: ProjectPeopleCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("project.people")}</CardTitle>
				<CardAction>
					<Button variant="outline" size="icon" asChild>
						<Link to="/app/team" aria-label={t("project.openTeam")}>
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{members.map((member) => {
						const openCount = tasks.filter(
							(task) => task.assigneeId === member.id && task.status !== "done",
						).length;
						return (
							<li key={member.id} className="flex items-center gap-4">
								<PersonAvatar name={member.name} className="size-10 text-sm" />
								<span className="grid min-w-0 flex-1 gap-0.5">
									<span className="flex items-center gap-2 font-medium">
										<bdi className="truncate">{member.name}</bdi>
										{member.id === leadId ? (
											<Badge variant="secondary">{t("project.lead")}</Badge>
										) : null}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{member.role}
									</span>
								</span>
								<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
									{fillMessage(t("project.openCount"), {
										count: number.format(openCount),
									})}
								</span>
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
