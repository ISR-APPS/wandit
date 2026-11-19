// The students card of the course page: five students, the ones behind first, each with an "Open" button.
// CourseDetailPage renders it beside the assignments card, where the kit profile shows its connections.
// The arrow button opens the Students tab of the same page.
import { Link } from "@tanstack/react-router";
import { PersonAvatar } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { Learner } from "../api/courses.queries";

// The card shows five students, as the kit card.
const SHOWN_LEARNERS = 5;

type CourseLearnersCardProps = {
	/** The students of the course, by name, from the course query. */
	learners: Learner[];
	/** Opens the Students tab of the page. */
	onShowAll: () => void;
};

/** A student who is behind gets the filled button, so the eye finds them first. */
export function CourseLearnersCard({
	learners,
	onShowAll,
}: CourseLearnersCardProps) {
	const { t } = useT();
	// Behind first; the sort keeps the name order inside each group.
	const shown = [...learners]
		.sort(
			(first, second) =>
				Number(second.state === "behind") - Number(first.state === "behind"),
		)
		.slice(0, SHOWN_LEARNERS);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.students")}</CardTitle>
				<CardAction>
					<Button
						type="button"
						variant="outline"
						size="icon"
						aria-label={t("courses.allStudents")}
						onClick={onShowAll}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{shown.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noLearners")}
					</p>
				) : (
					<ul className="grid gap-4">
						{shown.map((learner) => (
							<li key={learner.id} className="flex items-center gap-3">
								<PersonAvatar name={learner.name} className="size-9" />
								<div className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm">
										{learner.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{learner.email}
									</span>
								</div>
								<Button
									size="sm"
									variant={learner.state === "behind" ? "default" : "outline"}
									asChild
								>
									<Link to="/app/students" search={{ student: learner.id }}>
										{t(
											learner.state === "behind"
												? "courses.review"
												: "courses.openRecord",
										)}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
