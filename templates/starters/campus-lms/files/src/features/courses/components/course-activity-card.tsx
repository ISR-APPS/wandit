// The "Latest activity" card of the course page: the newest events of the course on a line timeline.
// CourseDetailPage renders it first in the wide column, as the kit profile. The newest event gets a badge,
// and a button to its work when it is a submission or a grade.
import {
	CheckCircleIcon,
	ClockIcon,
	type Icon,
	PaperPlaneTiltIcon,
	SealCheckIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { fillMessage, formatRelativeTime } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { CourseEvent } from "../api/courses.queries";

/** The icon in the dot of each kind of event. */
const EVENT_ICON = {
	module: SealCheckIcon,
	submission: PaperPlaneTiltIcon,
	grade: CheckCircleIcon,
	enrollment: UserPlusIcon,
} satisfies Record<CourseEvent["kind"], Icon>;

type CourseActivityCardProps = {
	/** The newest events, newest first, from the course query. */
	events: CourseEvent[];
};

/** No event: one sentence. */
export function CourseActivityCard({ events }: CourseActivityCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	// The sentence of one event, in the words of its kind.
	function sentenceOf(event: CourseEvent): string {
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
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.activity")}</CardTitle>
			</CardHeader>
			<CardContent>
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noActivity")}
					</p>
				) : (
					<ol className="ms-3 grid border-s">
						{events.map((event, index) => {
							const EventIcon = EVENT_ICON[event.kind];
							return (
								<li
									key={event.id}
									className="relative grid gap-1.5 ps-6 pb-8 last:pb-0"
								>
									<span
										aria-hidden="true"
										className="absolute -start-3 top-0 flex size-6 items-center justify-center rounded-full border bg-muted"
									>
										<EventIcon className="size-3 text-primary" />
									</span>
									<h3 className="flex flex-wrap items-center gap-2 font-semibold">
										{event.studentName}
										{index === 0 ? (
											<Badge variant="outline">{t("courses.latest")}</Badge>
										) : null}
									</h3>
									<time
										dateTime={event.occurredAt}
										className="flex items-center gap-1.5 text-muted-foreground text-sm leading-none"
									>
										<ClockIcon aria-hidden="true" className="size-3" />
										{formatRelativeTime(event.occurredAt, now, locale)}
									</time>
									<p className="text-muted-foreground text-sm">
										{sentenceOf(event)}
									</p>
									{index === 0 &&
									(event.kind === "submission" || event.kind === "grade") ? (
										<div className="pt-1">
											<Button variant="outline" size="sm" asChild>
												<Link
													to="/app/assignments"
													search={{ submission: event.submissionId }}
												>
													{t("courses.openWork")}
												</Link>
											</Button>
										</div>
									) : null}
								</li>
							);
						})}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}
