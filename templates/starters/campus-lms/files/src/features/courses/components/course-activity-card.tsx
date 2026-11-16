// The rail card of the course page with the newest events: modules finished, work turned in, grades, and enrollments.
// CourseDetailPage renders it last in the rail. The events come newest first from the course query.
// Each event kind has its own icon, so the eye finds the grades and the new students fast.
import {
	BookOpenTextIcon,
	PaperPlaneTiltIcon,
	SealCheckIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import {
	DISPLAY_CARD_TITLE,
	fillMessage,
	formatRelativeTime,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { CourseEvent } from "../api/courses.queries";

/** The icon of each event kind. */
const EVENT_ICONS = {
	module: BookOpenTextIcon,
	submission: PaperPlaneTiltIcon,
	grade: SealCheckIcon,
	enrollment: UserPlusIcon,
} satisfies Record<CourseEvent["kind"], KitIcon>;

type CourseActivityCardProps = {
	/** The newest events of the course, newest first. */
	events: CourseEvent[];
};

/** A vertical timeline. The line between the icons is a border of the list item. */
export function CourseActivityCard({ events }: CourseActivityCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	// The words after the name of the student, for each event kind.
	const describe = (event: CourseEvent): string => {
		switch (event.kind) {
			case "module":
				return fillMessage(t("courses.events.module"), {
					module: event.moduleTitle,
				});
			case "submission":
				return fillMessage(t("courses.events.submission"), {
					assignment: event.assignmentTitle,
				});
			case "grade":
				return fillMessage(t("courses.events.grade"), {
					points: number.format(event.points),
					assignment: event.assignmentTitle,
				});
			case "enrollment":
				return t("courses.events.enrollment");
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{t("courses.activity")}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noActivity")}
					</p>
				) : (
					<ol className="grid">
						{events.map((event, index) => {
							const EventIcon = EVENT_ICONS[event.kind];
							return (
								<li
									key={event.id}
									className="relative flex gap-3 pb-4 last:pb-0"
								>
									{/* The rail line joins this icon to the next one. The last event has none. */}
									{index < events.length - 1 ? (
										<span
											aria-hidden="true"
											className="absolute start-3.5 top-8 bottom-0 w-px bg-border/20"
										/>
									) : null}
									<span
										aria-hidden="true"
										className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-4"
									>
										<EventIcon />
									</span>
									<div className="grid min-w-0 gap-0.5 pt-0.5 text-sm">
										<p>
											<span className="font-medium">{event.studentName}</span>{" "}
											<span className="text-muted-foreground">
												{describe(event)}
											</span>
										</p>
										<p className="text-muted-foreground text-xs">
											{formatRelativeTime(event.occurredAt, now, locale)}
										</p>
									</div>
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
