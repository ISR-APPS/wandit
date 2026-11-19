// The profile card of the course page: the track tile, the title and level, three figures in a strip,
// and the facts with an icon each. CourseDetailPage renders it first in the start column, as the kit profile card.
import {
	ArmchairIcon,
	CalendarBlankIcon,
	ChalkboardTeacherIcon,
	ClockIcon,
	HourglassMediumIcon,
} from "@phosphor-icons/react";
import {
	dateFormat,
	fillMessage,
	formatSchedule,
	TrackTile,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { CourseDetail } from "../api/courses.queries";

type CourseProfileCardProps = {
	/** The course of the page, from the course query. */
	course: CourseDetail;
};

/** The strip cells take a start rule from the second cell, so the rules follow the reading direction. */
export function CourseProfileCard({ course }: CourseProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const dates = dateFormat(locale);
	const figures = [
		{ key: "students", value: course.enrolled, label: t("courses.students") },
		{ key: "lessons", value: course.lessonCount, label: t("courses.lessons") },
		{ key: "weeks", value: course.weeks, label: t("courses.weeksLabel") },
	];
	const facts = [
		{
			key: "instructor",
			icon: ChalkboardTeacherIcon,
			text: `${course.instructor.name} · ${course.instructor.title}`,
		},
		{
			key: "schedule",
			icon: ClockIcon,
			text: formatSchedule(course.classDays, course.classTime, locale),
		},
		{
			key: "dates",
			icon: CalendarBlankIcon,
			text: `${dates.format(new Date(course.startAt))} – ${dates.format(new Date(course.endAt))}`,
		},
		{
			key: "seats",
			icon: ArmchairIcon,
			text: fillMessage(t("courses.seats"), {
				enrolled: number.format(course.enrolled),
				seats: number.format(course.seats),
			}),
		},
		{
			key: "toGrade",
			icon: HourglassMediumIcon,
			text: fillMessage(t("courses.toGrade"), {
				count: number.format(course.toGrade),
			}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-4 text-center">
					<TrackTile
						track={course.track}
						className="size-20 rounded-full [&_svg]:size-9"
					/>
					<div className="grid gap-1">
						<h2 className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							{course.title}
							<Badge variant="info">{t(`levels.${course.level}`)}</Badge>
						</h2>
						<p className="text-muted-foreground text-sm">
							{`${course.code} · ${t(`tracks.${course.track}`)}`}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 rounded-md border bg-muted text-center">
					{figures.map((figure) => (
						// The term comes first for screen readers; the reverse column shows the value on top.
						<div
							key={figure.key}
							className="flex flex-col-reverse gap-0.5 not-first:border-s py-3"
						>
							<dt className="text-muted-foreground text-sm">{figure.label}</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{number.format(figure.value)}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4 text-sm">
					{facts.map((fact) => (
						<li key={fact.key} className="flex items-center gap-3">
							<fact.icon
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground"
							/>
							<span className="min-w-0">{fact.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
