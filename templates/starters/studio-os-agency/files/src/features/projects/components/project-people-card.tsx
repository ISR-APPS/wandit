// The people of one project: the lead first, then the team, with the hours each one logged on it.
// The project detail page renders it in its rail. The bar compares each person with the busiest one.
import { PersonAvatar, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ProjectPerson } from "../lib/project-detail";

type ProjectPeopleCardProps = {
	people: ProjectPerson[];
};

/** Each row: the avatar, the name and role, the hours, and a thin bar of the share of the most hours. */
export function ProjectPeopleCard({ people }: ProjectPeopleCardProps) {
	const { t } = useT();
	const format = useFormatters();
	const most = Math.max(1, ...people.map((person) => person.hours));
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("projectDetail.people")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-4">
					{people.map((person) => (
						<li key={person.id} className="grid gap-2">
							<div className="flex items-center gap-3">
								<PersonAvatar name={person.name} />
								<div className="grid min-w-0 flex-1">
									<span className="flex items-center gap-2 font-medium text-sm">
										<span className="truncate">{person.name}</span>
										{person.isLead ? (
											<Badge variant="secondary">
												{t("projectDetail.lead")}
											</Badge>
										) : null}
									</span>
									<span className="text-muted-foreground text-xs">
										{t(`codes.roles.${person.role}`)}
									</span>
								</div>
								<span className="font-medium text-sm tabular-nums">
									{format.hours(person.hours)}
								</span>
							</div>
							<div aria-hidden="true" className="h-1 rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary"
									style={{ width: `${(person.hours / most) * 100}%` }}
								/>
							</div>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
