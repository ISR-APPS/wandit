// The badge of the state of a course assignment: open, to grade, or graded.
// The assignments card and the assignments table of the course page render it.
import type { VariantProps } from "class-variance-authority";
import { useT } from "~/shared/i18n";
import { Badge, type badgeVariants } from "~/shared/ui/badge";
import type { CourseAssignmentState } from "../api/courses.queries";

/** Badge variant per state. Work that waits is the only warning. */
const STATE_VARIANT = {
	open: "info",
	to_grade: "warning",
	graded: "success",
} satisfies Record<
	CourseAssignmentState,
	VariantProps<typeof badgeVariants>["variant"]
>;

type AssignmentStateBadgeProps = {
	state: CourseAssignmentState;
};

/** The translated state word. The color is never the only mark. */
export function AssignmentStateBadge({ state }: AssignmentStateBadgeProps) {
	const { t } = useT();
	return (
		<Badge variant={STATE_VARIANT[state]}>
			{t(`courses.assignmentStates.${state}`)}
		</Badge>
	);
}
