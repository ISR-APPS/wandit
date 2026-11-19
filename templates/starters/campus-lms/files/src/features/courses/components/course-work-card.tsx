// The assignments card of the course page: a small table of the assignments with their kind, state, and due day.
// CourseDetailPage renders it under the activity card, where the kit profile shows its transaction history.
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
import type { CourseAssignment } from "../api/courses.queries";
import { AssignmentStateBadge } from "./assignment-state-badge";

type CourseWorkCardProps = {
	/** The assignments of the course in due order, from the course query. */
	assignments: CourseAssignment[];
};

/** Three columns. The Assignments tab of the page has the full table. */
export function CourseWorkCard({ assignments }: CourseWorkCardProps) {
	const { t, locale } = useT();
	// Day and month only, so the three columns fit the narrow card.
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.assignments")}</CardTitle>
			</CardHeader>
			<CardContent>
				{assignments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noAssignments")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("courses.assignment")}</TableHead>
								<TableHead>{t("courses.state")}</TableHead>
								<TableHead className="text-end">{t("courses.due")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{assignments.map((assignment) => (
								<TableRow key={assignment.id}>
									{/* Two lines, as the student rows beside it, so both cards fill the same height. */}
									<TableCell className="whitespace-normal">
										<span className="grid">
											<span>{assignment.title}</span>
											<span className="text-muted-foreground text-xs">
												{t(`assignments.kinds.${assignment.kind}`)}
											</span>
										</span>
									</TableCell>
									<TableCell>
										<AssignmentStateBadge state={assignment.state} />
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{shortDate.format(new Date(assignment.dueAt))}
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
