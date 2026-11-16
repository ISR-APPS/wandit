// The table of the Team tab: the 8 most loaded people of the period, with their utilization and hours.
// The overview reads the team load of the team feature. "See all" opens the Team page.

import { PersonAvatar, useFormatters } from "~/features/studio";
import type { MemberLoad } from "~/features/team";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { SeeAllLink } from "./see-all-link";

type TeamUtilizationCardProps = {
	/** Every member, the highest utilization first. The card shows the first 8. */
	members: MemberLoad[];
};

/** Above 100 % the share turns red: the person works overtime. */
export function TeamUtilizationCard({ members }: TeamUtilizationCardProps) {
	const { t } = useT();
	const format = useFormatters();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.mostLoaded")}</CardTitle>
				<CardAction>
					<SeeAllLink to="/app/team" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("team.person")}</TableHead>
							<TableHead className="text-end">{t("team.billable")}</TableHead>
							<TableHead className="text-end">
								{t("team.utilization")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.slice(0, 8).map((member) => (
							<TableRow key={member.id}>
								<TableCell>
									<div className="flex items-center gap-2.5">
										<PersonAvatar name={member.name} />
										<div className="grid">
											<span className="font-medium">{member.name}</span>
											<span className="text-muted-foreground text-xs">
												{t(`codes.roles.${member.role}`)}
											</span>
										</div>
									</div>
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{format.hours(member.billable)}
								</TableCell>
								<TableCell
									className={cn(
										"text-end font-medium tabular-nums",
										member.utilization > 1 && "text-destructive",
									)}
								>
									{format.percent(member.utilization)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
