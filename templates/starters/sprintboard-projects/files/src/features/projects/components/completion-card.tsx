// The completion card of a project page: the done story points against all story points, as a bar and a percent.
// ProjectDetailPage renders it under the profile card. progressOf gives the same percent as the project cards.
import { fillMessage } from "~/features/tracker";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Project } from "../api/projects.queries";
import { progressOf } from "../lib/project-progress";

/** The line under the bar names the points, so the percent is never alone. */
export function CompletionCard({ project }: { project: Project }) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const progress = progressOf(project);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("project.completion")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-2">
				<div className="flex items-center gap-4">
					<Progress value={progress} aria-label={t("project.completion")} />
					<span className="text-muted-foreground text-sm tabular-nums">
						{percent.format(progress / 100)}
					</span>
				</div>
				<p className="text-muted-foreground text-xs tabular-nums">
					{fillMessage(t("project.pointsDone"), {
						done: number.format(project.pointsDone),
						total: number.format(project.pointsTotal),
					})}
				</p>
			</CardContent>
		</Card>
	);
}
