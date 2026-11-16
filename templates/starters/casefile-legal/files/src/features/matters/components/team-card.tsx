// The team of one matter: each person who logged time on it, with the role and the hours.
// MatterDetailPage renders it in the rail. The lead attorney comes first, with a Lead badge.
import { fillMessage, hoursFormat, PersonAvatar } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TeamMember } from "../lib/matter-joins";

type TeamCardProps = {
	/** The lead first, then by hours. */
	team: TeamMember[];
};

/** One row per person. The hours are every hour logged on the matter. */
export function TeamCard({ team }: TeamCardProps) {
	const { t, locale } = useT();
	const hours = hoursFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.team")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-3">
					{team.map((member) => (
						<li key={member.attorneyId} className="flex items-center gap-3">
							<PersonAvatar name={member.name} />
							<span className="grid min-w-0 flex-1 text-sm">
								<span className="flex items-center gap-2">
									<span className="truncate font-medium">{member.name}</span>
									{member.isLead ? (
										<Badge variant="secondary">{t("matters.leadBadge")}</Badge>
									) : null}
								</span>
								<span className="text-muted-foreground text-xs">
									{t(`roles.${member.role}`)}
								</span>
							</span>
							<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
								{fillMessage(t("matters.hoursOnMatter"), {
									hours: hours.format(member.hours),
								})}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
