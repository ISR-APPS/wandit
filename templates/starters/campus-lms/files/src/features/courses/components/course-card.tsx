// One course of the Courses page as a card: track, title, instructor, class times, progress, seats, and work to grade.
// CoursesPage renders one per course. The title link covers the whole card and opens the course page.
// The progress line depends on the state: the week of a running course, the first day of the next one, the certificates of a finished one.
import {
	BookOpenTextIcon,
	CalendarDotsIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	COURSE_STATUS_BADGE,
	dateFormat,
	fillMessage,
	formatRelativeTime,
	formatSchedule,
	PersonAvatar,
	TrackTile,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import type { Course } from "../api/courses.queries";

type CourseCardProps = {
	/** One row of the course list query. */
	course: Course;
};

/** The card lifts on hover, because the whole card is the link. */
export function CourseCard({ course }: CourseCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	// One progress line per state: the label at the start, the figure at the end, and the bar.
	const progress =
		course.status === "running"
			? {
					label: fillMessage(t("courses.weekOf"), {
						week: number.format(course.week),
						weeks: number.format(course.weeks),
					}),
					figure: fillMessage(t("courses.lessonsOpen"), {
						released: number.format(course.lessonsReleased),
						total: number.format(course.lessonCount),
					}),
					value: course.lessonsReleased,
					max: course.lessonCount,
				}
			: course.status === "upcoming"
				? {
						label: fillMessage(t("courses.startsIn"), {
							when: formatRelativeTime(course.startAt, now, locale),
						}),
						figure: fillMessage(t("courses.seats"), {
							enrolled: number.format(course.enrolled),
							seats: number.format(course.seats),
						}),
						value: course.enrolled,
						max: course.seats,
					}
				: {
						label: fillMessage(t("courses.endedOn"), {
							date: dateFormat(locale).format(new Date(course.endAt)),
						}),
						figure: fillMessage(t("courses.certified"), {
							count: number.format(course.certificates),
							total: number.format(course.enrolled),
						}),
						value: course.certificates,
						max: course.enrolled,
					};

	return (
		<Card className="relative gap-4 py-5 transition-transform focus-within:-translate-y-0.5 hover:-translate-y-0.5 motion-reduce:transition-none">
			<CardHeader className="flex items-start gap-3 px-5">
				<TrackTile track={course.track} />
				<div className="grid min-w-0 flex-1 gap-1">
					<p className="text-muted-foreground text-xs">
						{fillMessage(t("courses.meta"), {
							code: course.code,
							track: t(`tracks.${course.track}`),
							level: t(`levels.${course.level}`),
						})}
					</p>
					<h2 className="font-(--heading-weight) font-display text-lg leading-snug tracking-(--heading-tracking)">
						{/* The ::after box stretches the link over the card, so the whole card opens the course. */}
						<Link
							to="/app/courses/$courseId"
							params={{ courseId: course.id }}
							className="outline-none after:absolute after:inset-0 after:rounded-surface focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
						>
							{course.title}
						</Link>
					</h2>
				</div>
			</CardHeader>
			<CardContent className="grid gap-4 px-5">
				<div className="grid gap-1.5 text-sm">
					<p className="flex items-center gap-2">
						<PersonAvatar
							name={course.instructorName}
							className="size-6 text-[0.625rem]"
						/>
						<span className="truncate">{course.instructorName}</span>
					</p>
					<p className="flex items-center gap-2 text-muted-foreground">
						<CalendarDotsIcon className="size-6 shrink-0 p-0.5" />
						<span className="truncate">
							{formatSchedule(course.classDays, course.classTime, locale)}
						</span>
					</p>
				</div>
				<div className="grid gap-2">
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="font-medium">{progress.label}</span>
						<span className="text-muted-foreground tabular-nums">
							{progress.figure}
						</span>
					</div>
					<Progress
						value={progress.value}
						max={progress.max}
						aria-label={progress.label}
					/>
				</div>
			</CardContent>
			{/* mt-auto keeps the footer at the bottom when a long title makes a card of the row taller. */}
			<CardFooter className="mt-auto justify-between gap-3 border-border/15 border-t px-5 pt-4 text-sm">
				{/* The progress line of a course that starts soon shows its seats, so the footer gives its length. */}
				{course.status === "upcoming" ? (
					<span className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
						<BookOpenTextIcon className="size-4" />
						{fillMessage(t("courses.length"), {
							weeks: number.format(course.weeks),
							lessons: number.format(course.lessonCount),
						})}
					</span>
				) : (
					<span className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
						<UsersThreeIcon className="size-4" />
						{fillMessage(t("courses.seats"), {
							enrolled: number.format(course.enrolled),
							seats: number.format(course.seats),
						})}
					</span>
				)}
				<span className="flex flex-wrap justify-end gap-1.5">
					{course.toGrade > 0 ? (
						<Badge variant="warning">
							{fillMessage(t("courses.toGrade"), {
								count: number.format(course.toGrade),
							})}
						</Badge>
					) : null}
					<Badge variant={COURSE_STATUS_BADGE[course.status]}>
						{t(`courses.statuses.${course.status}`)}
					</Badge>
				</span>
			</CardFooter>
		</Card>
	);
}
