// The tag card of the course page: the module titles of the course as outline badges.
// CourseDetailPage renders it last in the start column, where the kit profile shows its skills.
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type CourseTopicsCardProps = {
	/** The module titles, in course order. */
	topics: string[];
};

/** The badges wrap on as many rows as they need. */
export function CourseTopicsCard({ topics }: CourseTopicsCardProps) {
	const { t } = useT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.topics")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{topics.map((topic) => (
					<Badge key={topic} variant="outline">
						{topic}
					</Badge>
				))}
			</CardContent>
		</Card>
	);
}
