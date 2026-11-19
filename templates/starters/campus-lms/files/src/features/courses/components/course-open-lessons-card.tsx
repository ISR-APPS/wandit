// The small bar card of the course page: the share of the lessons that are open to the students.
// CourseDetailPage renders it under the profile card, where the kit profile shows "Complete your profile".
import { shareFormat } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type CourseOpenLessonsCardProps = {
	/** Count of lessons that are open today. */
	released: number;
	/** Count of all lessons of the course. */
	total: number;
};

/** The bar and the share on one row. */
export function CourseOpenLessonsCard({
	released,
	total,
}: CourseOpenLessonsCardProps) {
	const { t, locale } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.lessonsReleased")}</CardTitle>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress
					value={released}
					max={total}
					aria-label={t("courses.lessonsReleased")}
				/>
				<span className="text-muted-foreground text-sm tabular-nums">
					{total === 0 ? "–" : shareFormat(locale).format(released / total)}
				</span>
			</CardContent>
		</Card>
	);
}
