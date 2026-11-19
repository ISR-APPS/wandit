// The team of one matter as a row of badges: each person with their hours, the lead first.
// MatterDetailPage renders it under the fee card, in the place of the kit "skills" card.
import { hoursFormat } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TeamMember } from "../lib/matter-joins";

type TeamCardProps = {
	/** The lead first, then by hours on the matter. */
	team: TeamMember[];
};

/** The lead badge says "Lead" and uses the secondary fill. The other badges name the role. */
export function TeamCard({ team }: TeamCardProps) {
	const { t, locale } = useT();
	const hours = hoursFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.team")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-wrap gap-2">
					{team.map((member) => (
						<li key={member.attorneyId}>
							<Badge
								variant={member.isLead ? "secondary" : "outline"}
								className="tabular-nums"
							>
								{[
									member.name,
									member.isLead
										? t("matters.leadBadge")
										: t(`roles.${member.role}`),
									`${hours.format(member.hours)} h`,
								].join(" · ")}
							</Badge>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
