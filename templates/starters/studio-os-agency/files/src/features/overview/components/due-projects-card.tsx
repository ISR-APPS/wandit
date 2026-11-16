// The table of the Projects tab: the 8 live projects with the nearest due day, retainers left out.
// The overview reads the project list of the projects feature. A row opens the project detail.
import { Link } from "@tanstack/react-router";
import {
	HealthBadge,
	PhaseBadge,
	type ProjectSummary,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
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

type DueProjectsCardProps = {
	/** Live fixed and hourly projects, the nearest due day first. The card shows the first 8. */
	projects: ProjectSummary[];
};

/** The due cell reads "in 4 days" or "3 days ago": a late project shows at the top. */
export function DueProjectsCard({ projects }: DueProjectsCardProps) {
	const { t } = useT();
	const format = useFormatters();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.dueNext")}</CardTitle>
				<CardAction>
					<SeeAllLink to="/app/projects" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("projects.project")}</TableHead>
							{/* A phone-width card has room for two columns. The health badge moves under the name. */}
							<TableHead className="@max-md/main:hidden">
								{t("projects.health")}
							</TableHead>
							<TableHead className="text-end">{t("projects.due")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{projects.slice(0, 8).map((project) => (
							<TableRow key={project.id}>
								<TableCell>
									<div className="grid justify-items-start">
										<Link
											to="/app/projects/$projectId"
											params={{ projectId: project.id }}
											className="font-medium hover:underline"
										>
											{project.name}
										</Link>
										<span className="text-muted-foreground text-xs">
											{project.clientName}
										</span>
										{project.health ? (
											<span className="@md/main:hidden pt-1">
												<HealthBadge health={project.health} />
											</span>
										) : null}
									</div>
								</TableCell>
								<TableCell className="@max-md/main:hidden">
									<div className="flex flex-wrap gap-1.5">
										<PhaseBadge phase={project.phase} />
										{project.health ? (
											<HealthBadge health={project.health} />
										) : null}
									</div>
								</TableCell>
								<TableCell className="text-end text-sm">
									{project.dueDay ? format.relativeDay(project.dueDay) : null}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
