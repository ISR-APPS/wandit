// The side panel with the record of one student: the facts, every course with its progress, and the newest work.
// StudentsPage renders it. The `?student=` search param of /app/students opens it, so a link can open one record.
// It reads the student with useQuery after the click, with its own loading, error, and not-found states.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	dateFormat,
	fillMessage,
	formatRelativeTime,
	LEARNER_STATE_BADGE,
	PersonAvatar,
	STUDENT_STATUS_BADGE,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Progress } from "~/shared/ui/progress";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { Skeleton } from "~/shared/ui/skeleton";
import { studentQueryOptions } from "../api/students.queries";

type StudentSheetProps = {
	/** The id of the open student, from the URL. undefined while the panel is closed. */
	studentId: string | undefined;
	/** Removes the id from the URL. */
	onClose: () => void;
};

/** A controlled Sheet on the end side. The query runs only while an id is in the URL. */
export function StudentSheet({ studentId, onClose }: StudentSheetProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...studentQueryOptions(studentId ?? ""),
		enabled: studentId !== undefined,
	});
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();
	const student = query.data;

	return (
		<Sheet
			open={studentId !== undefined}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{query.isPending ? (
					<div className="grid gap-4 p-6">
						<SheetTitle className="sr-only">{t("students.title")}</SheetTitle>
						<div className="flex items-center gap-3">
							<Skeleton className="size-14 rounded-full" />
							<div className="grid gap-2">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-4 w-52" />
							</div>
						</div>
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				) : !student ? (
					// An error, or an id that matches no student (null).
					<div className="grid justify-items-start gap-3 p-6">
						<SheetTitle>{t("students.title")}</SheetTitle>
						<p role={query.isError ? "alert" : undefined} className="text-sm">
							{t(query.isError ? "students.detailError" : "students.notFound")}
						</p>
						{query.isError ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => void query.refetch()}
							>
								{t("common.retry")}
							</Button>
						) : null}
					</div>
				) : (
					<>
						<SheetHeader className="gap-3 border-border/15 border-b p-6">
							<div className="flex items-center gap-4 pe-6">
								<PersonAvatar
									name={student.name}
									className="size-14 text-base"
								/>
								<div className="grid min-w-0 gap-1">
									<SheetTitle className="font-(--heading-weight) font-display text-xl tracking-(--heading-tracking)">
										{student.name}
									</SheetTitle>
									<SheetDescription className="truncate">
										{student.email}
									</SheetDescription>
								</div>
							</div>
							<Badge variant={STUDENT_STATUS_BADGE[student.status]}>
								{t(`students.statuses.${student.status}`)}
							</Badge>
						</SheetHeader>
						<div className="grid gap-6 p-6">
							{/* content-between keeps the three values on one line when a label wraps. */}
							<dl className="grid grid-cols-3 gap-3 text-sm *:content-between">
								<div className="grid gap-1">
									<dt className="label-text text-muted-foreground text-xs">
										{t("students.joined")}
									</dt>
									<dd className="font-medium tabular-nums">
										{dateFormat(locale).format(new Date(student.joinedAt))}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="label-text text-muted-foreground text-xs">
										{t("students.courseCount")}
									</dt>
									<dd className="font-medium tabular-nums">
										{number.format(student.courseCount)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="label-text text-muted-foreground text-xs">
										{t("students.average")}
									</dt>
									<dd className="font-medium tabular-nums">
										{student.averageGrade === null
											? "—"
											: number.format(Math.round(student.averageGrade))}
									</dd>
								</div>
							</dl>
							<section className="grid gap-3">
								<h3 className="font-semibold text-sm">
									{t("students.courses")}
								</h3>
								<ul className="grid gap-3">
									{student.enrollments.map((enrollment) => {
										// A finished course counts all lessons. A running one counts only the open lessons.
										const whole =
											enrollment.courseStatus === "completed"
												? enrollment.lessonCount
												: enrollment.released;
										return (
											<li
												key={enrollment.courseId}
												className="grid gap-2 rounded-control border border-border/20 p-3"
											>
												<div className="flex items-start justify-between gap-3">
													<Link
														to="/app/courses/$courseId"
														params={{ courseId: enrollment.courseId }}
														className="grid min-w-0 hover:underline"
													>
														<span className="text-muted-foreground text-xs">
															{enrollment.courseCode}
														</span>
														<span className="font-medium text-sm">
															{enrollment.courseTitle}
														</span>
													</Link>
													<Badge
														variant={LEARNER_STATE_BADGE[enrollment.state]}
													>
														{t(`learners.states.${enrollment.state}`)}
													</Badge>
												</div>
												{whole > 0 ? (
													<>
														<Progress
															value={enrollment.done}
															max={whole}
															aria-label={enrollment.courseTitle}
															className="h-1.5"
														/>
														<p className="text-muted-foreground text-xs tabular-nums">
															{fillMessage(
																t(
																	enrollment.courseStatus === "completed"
																		? "students.lessonsAll"
																		: "students.lessonsOf",
																),
																{
																	done: number.format(enrollment.done),
																	released: number.format(enrollment.released),
																	total: number.format(enrollment.lessonCount),
																},
															)}
														</p>
													</>
												) : null}
											</li>
										);
									})}
								</ul>
							</section>
							<section className="grid gap-2">
								<h3 className="font-semibold text-sm">
									{t("students.recentWork")}
								</h3>
								{student.recentWork.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("students.noWork")}
									</p>
								) : (
									<ul className="divide-y divide-border/15">
										{student.recentWork.map((work) => (
											<li key={work.id}>
												<Link
													to="/app/assignments"
													search={{ submission: work.id }}
													className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 hover:bg-muted"
												>
													<span className="grid min-w-0 flex-1">
														<span className="truncate font-medium text-sm">
															{work.assignmentTitle}
														</span>
														<span className="text-muted-foreground text-xs">
															{`${work.courseCode} · ${formatRelativeTime(work.submittedAt, now, locale)}`}
														</span>
													</span>
													{work.points === null ? (
														<Badge variant="warning">
															{t("assignments.statuses.to_grade")}
														</Badge>
													) : (
														<span className="font-semibold text-sm tabular-nums">
															{fillMessage(t("students.points"), {
																points: number.format(work.points),
																max: number.format(work.maxPoints),
															})}
														</span>
													)}
												</Link>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
