// The assignments of one course in due order: the kind, the due day, the work turned in, the grades, and the mean grade.
// CourseDetailPage renders it in the main column. It reads only the course object that the page passes.
import {
	DISPLAY_CARD_TITLE,
	dateFormat,
	FIRST_COLUMN_ON_PHONE,
	fillMessage,
	formatRelativeTime,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { CourseDetail } from "../api/courses.queries";

type CourseAssignmentsCardProps = {
	/** The course of the page, with its assignments. */
	course: CourseDetail;
};

/** "Turned in" compares with the students of the course; "Graded" compares with the work that came in. */
export function CourseAssignmentsCard({ course }: CourseAssignmentsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const date = dateFormat(locale);
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{t("courses.assignments")}
				</CardTitle>
			</CardHeader>
			<CardContent className={FIRST_COLUMN_ON_PHONE}>
				{course.assignments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noAssignments")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("courses.assignment")}</TableHead>
								<TableHead>{t("courses.due")}</TableHead>
								<TableHead className="text-end">
									{t("courses.turnedIn")}
								</TableHead>
								<TableHead className="text-end">
									{t("courses.graded")}
								</TableHead>
								<TableHead className="text-end">
									{t("courses.average")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{course.assignments.map((assignment) => (
								<TableRow key={assignment.id}>
									<TableCell>
										<div className="grid min-w-44 justify-items-start">
											<span className="font-medium">{assignment.title}</span>
											<span className="text-muted-foreground text-xs">
												{t(`assignments.kinds.${assignment.kind}`)}
											</span>
											{/* On a phone this is the only column, so it also gives the due day and the work in. */}
											<span className="@2xl/main:hidden text-muted-foreground text-xs tabular-nums">
												{fillMessage(t("courses.dueAndTurnedIn"), {
													date: date.format(new Date(assignment.dueAt)),
													submitted: number.format(assignment.submitted),
													total: number.format(course.enrolled),
												})}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<div className="grid whitespace-nowrap">
											<span className="tabular-nums">
												{date.format(new Date(assignment.dueAt))}
											</span>
											<span className="text-muted-foreground text-xs">
												{formatRelativeTime(assignment.dueAt, now, locale)}
											</span>
										</div>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{`${number.format(assignment.submitted)} / ${number.format(course.enrolled)}`}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{`${number.format(assignment.graded)} / ${number.format(assignment.submitted)}`}
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{assignment.averagePoints === null ? (
											<span className="text-muted-foreground">—</span>
										) : (
											number.format(Math.round(assignment.averagePoints))
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
