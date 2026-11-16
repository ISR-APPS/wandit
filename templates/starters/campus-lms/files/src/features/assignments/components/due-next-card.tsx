// The "Due next" card of the Assignments page: the next deadlines of the running courses, with the work already in.
// AssignmentsPage renders it beside the submission table. The /app/assignments loader fills its query.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	DISPLAY_CARD_TITLE,
	fillMessage,
	formatRelativeTime,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";
import { dueNextQueryOptions } from "../api/submissions.queries";

/** Each row links to its course page. The bar shows the work turned in of the students of the course. */
export function DueNextCard() {
	const { t, locale } = useT();
	const { data: assignments } = useSuspenseQuery(dueNextQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const now = Date.now();

	return (
		<Card>
			<CardHeader>
				<CardTitle className={DISPLAY_CARD_TITLE}>
					{t("assignments.dueNext")}
				</CardTitle>
				<CardDescription>{t("assignments.dueNextDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				{assignments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("assignments.noDueNext")}
					</p>
				) : (
					<ul className="grid gap-4">
						{assignments.map((assignment) => (
							<li key={assignment.id} className="grid gap-2">
								<div className="flex items-start justify-between gap-3">
									<Link
										to="/app/courses/$courseId"
										params={{ courseId: assignment.courseId }}
										className="grid min-w-0 hover:underline"
									>
										<span className="font-medium text-sm">
											{assignment.title}
										</span>
										<span className="text-muted-foreground text-xs">
											{`${assignment.courseCode} · ${t(`assignments.kinds.${assignment.kind}`)}`}
										</span>
									</Link>
									<Badge variant="outline" className="shrink-0">
										{formatRelativeTime(assignment.dueAt, now, locale)}
									</Badge>
								</div>
								<Progress
									value={assignment.submitted}
									max={assignment.expected}
									aria-label={assignment.title}
									className="h-1.5"
								/>
								<p className="text-muted-foreground text-xs tabular-nums">
									{fillMessage(t("assignments.turnedInOf"), {
										submitted: number.format(assignment.submitted),
										expected: number.format(assignment.expected),
									})}
								</p>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
