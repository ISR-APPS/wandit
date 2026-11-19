// The "Course progress" card of the home: two running courses, each a boxed link with its open modules as a bar.
// DashboardPage renders it in the top band, beside the welcome card. It reads only its props.
import { PathIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage } from "~/features/school";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { CoursePath } from "../api/dashboard.queries";

// The kit colors the two bars green and orange. The status tokens give the same pair in every theme.
const BAR_TINTS = [
	"[&>[data-slot=progress-indicator]]:bg-success",
	"[&>[data-slot=progress-indicator]]:bg-warning",
] as const;

type CoursePathsCardProps = {
	/** The 2 running courses that started first, from the summary query. */
	paths: CoursePath[];
};

/** Each box opens the page of its course. No running course: one sentence. */
export function CoursePathsCard({ paths }: CoursePathsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("dashboard.pathsTitle")}</CardTitle>
				<CardAction>
					<PathIcon
						aria-hidden="true"
						className="size-4 text-muted-foreground"
					/>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				{paths.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noRunningCourse")}
					</p>
				) : (
					paths.map((path, index) => {
						const modules = fillMessage(t("dashboard.modulesOpen"), {
							open: number.format(path.modulesOpen),
							total: number.format(path.moduleCount),
						});
						return (
							<Link
								key={path.id}
								to="/app/courses/$courseId"
								params={{ courseId: path.id }}
								className="grid gap-2 rounded-md border p-4 transition-colors hover:bg-muted"
							>
								<span className="text-muted-foreground text-xs">
									{path.code}
								</span>
								<span className="font-semibold text-lg leading-snug">
									{path.title}
								</span>
								<Progress
									value={path.modulesOpen}
									max={path.moduleCount}
									aria-label={modules}
									className={BAR_TINTS[index % BAR_TINTS.length]}
								/>
								<span className="text-muted-foreground text-xs tabular-nums">
									{modules}
								</span>
							</Link>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
