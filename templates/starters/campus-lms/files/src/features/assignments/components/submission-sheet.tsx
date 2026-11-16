// The side panel of one submission: who sent what and when, the grade and the feedback, the note, and the other work in the course.
// AssignmentsPage renders it. The `?submission=` search param of /app/assignments opens it, so the home and the student panel link to it.
// It reads the submission with useQuery while an id is in the URL, with its own loading, error, and not-found states.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	dateFormat,
	fillMessage,
	formatRelativeTime,
	GRADING_TARGET_DAYS,
	PersonAvatar,
	WaitBadge,
	waitDaysOf,
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
import { submissionQueryOptions } from "../api/submissions.queries";

type SubmissionSheetProps = {
	/** The id of the open submission, from the URL. undefined while the panel is closed. */
	submissionId: string | undefined;
	/** Removes the id from the URL. */
	onClose: () => void;
};

/** A controlled Sheet on the end side. The query runs only while an id is in the URL. */
export function SubmissionSheet({
	submissionId,
	onClose,
}: SubmissionSheetProps) {
	const { t, locale } = useT();
	const query = useQuery({
		...submissionQueryOptions(submissionId ?? ""),
		enabled: submissionId !== undefined,
	});
	const number = new Intl.NumberFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const now = Date.now();
	const submission = query.data;

	return (
		<Sheet
			open={submissionId !== undefined}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{query.isPending ? (
					<div className="grid gap-4 p-6">
						<SheetTitle className="sr-only">
							{t("assignments.submission")}
						</SheetTitle>
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-7 w-64" />
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				) : !submission ? (
					// An error, or an id that matches no submission (null).
					<div className="grid justify-items-start gap-3 p-6">
						<SheetTitle>{t("assignments.submission")}</SheetTitle>
						<p role={query.isError ? "alert" : undefined} className="text-sm">
							{t(
								query.isError
									? "assignments.detailError"
									: "assignments.notFound",
							)}
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
						<SheetHeader className="gap-2 border-border/15 border-b p-6">
							<div className="flex flex-wrap items-center gap-2 pe-6">
								<Badge variant="secondary">
									{t(`assignments.kinds.${submission.kind}`)}
								</Badge>
								<span className="text-muted-foreground text-xs">
									{`${submission.courseCode} · ${submission.courseTitle}`}
								</span>
							</div>
							<SheetTitle className="font-(--heading-weight) font-display text-xl tracking-(--heading-tracking)">
								{submission.assignmentTitle}
							</SheetTitle>
							<SheetDescription>
								{fillMessage(t("assignments.by"), {
									name: submission.studentName,
								})}
							</SheetDescription>
						</SheetHeader>
						<div className="grid gap-6 p-6">
							<dl className="grid grid-cols-2 gap-4 text-sm">
								<div className="grid gap-1.5">
									<dt className="label-text text-muted-foreground text-xs">
										{t("assignments.student")}
									</dt>
									<dd>
										<Link
											to="/app/students"
											search={{ student: submission.studentId }}
											className="flex items-center gap-2 font-medium hover:underline"
										>
											<PersonAvatar
												name={submission.studentName}
												className="size-6 text-[0.625rem]"
											/>
											<span className="truncate">{submission.studentName}</span>
										</Link>
									</dd>
								</div>
								<div className="grid gap-1.5">
									<dt className="label-text text-muted-foreground text-xs">
										{t("assignments.course")}
									</dt>
									<dd>
										<Link
											to="/app/courses/$courseId"
											params={{ courseId: submission.courseId }}
											className="font-medium hover:underline"
										>
											{submission.courseCode}
										</Link>
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="label-text text-muted-foreground text-xs">
										{t("assignments.submitted")}
									</dt>
									<dd className="grid justify-items-start gap-1">
										<span className="tabular-nums">
											{dateTime.format(new Date(submission.submittedAt))}
										</span>
										{submission.isLate ? (
											<Badge variant="outline">{t("assignments.late")}</Badge>
										) : null}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="label-text text-muted-foreground text-xs">
										{t("assignments.due")}
									</dt>
									<dd className="tabular-nums">
										{dateFormat(locale).format(new Date(submission.dueAt))}
									</dd>
								</div>
							</dl>

							<section className="grid gap-3 rounded-control bg-muted p-4">
								{submission.points === null || submission.gradedAt === null ? (
									<>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<h3 className="font-semibold text-sm">
												{t("assignments.waiting")}
											</h3>
											{submission.waitBand ? (
												<WaitBadge
													band={submission.waitBand}
													days={waitDaysOf(submission.submittedAt, now)}
												/>
											) : null}
										</div>
										<p className="text-muted-foreground text-sm">
											{fillMessage(t("grading.target"), {
												target: number.format(GRADING_TARGET_DAYS),
											})}
										</p>
									</>
								) : (
									<>
										<div className="flex items-end justify-between gap-3">
											<h3 className="font-semibold text-sm">
												{t("assignments.grade")}
											</h3>
											<p className="font-bold font-numeric text-3xl tabular-nums leading-none">
												{number.format(submission.points)}
												<span className="font-medium text-base text-muted-foreground">
													{` / ${number.format(submission.maxPoints)}`}
												</span>
											</p>
										</div>
										<Progress
											value={submission.points}
											max={submission.maxPoints}
											aria-hidden="true"
										/>
										{submission.feedback ? (
											<div className="grid gap-1">
												<p className="label-text text-muted-foreground text-xs">
													{t("assignments.feedback")}
												</p>
												<p className="text-sm leading-relaxed">
													{submission.feedback}
												</p>
											</div>
										) : null}
										<p className="text-muted-foreground text-xs">
											{fillMessage(t("assignments.gradedBy"), {
												name: submission.instructorName,
												date: dateFormat(locale).format(
													new Date(submission.gradedAt),
												),
											})}
										</p>
									</>
								)}
							</section>

							<section className="grid gap-2">
								<h3 className="font-semibold text-sm">
									{t("assignments.note")}
								</h3>
								{submission.note ? (
									<blockquote
										dir="auto"
										className="rounded-control bg-accent px-3.5 py-3 text-accent-foreground text-sm leading-relaxed"
									>
										{submission.note}
									</blockquote>
								) : (
									<p className="text-muted-foreground text-sm">
										{t("assignments.noNote")}
									</p>
								)}
							</section>

							<section className="grid gap-2">
								<h3 className="font-semibold text-sm">
									{t("assignments.otherWork")}
								</h3>
								{submission.otherWork.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										{t("assignments.noOtherWork")}
									</p>
								) : (
									<ul className="divide-y divide-border/15">
										{submission.otherWork.map((work) => (
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
															{formatRelativeTime(
																work.submittedAt,
																now,
																locale,
															)}
														</span>
													</span>
													{work.points === null ? (
														<Badge variant="warning">
															{t("assignments.statuses.to_grade")}
														</Badge>
													) : (
														<span className="font-semibold text-sm tabular-nums">
															{`${number.format(work.points)} / ${number.format(work.maxPoints)}`}
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
