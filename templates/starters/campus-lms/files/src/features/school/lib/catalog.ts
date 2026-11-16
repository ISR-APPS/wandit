// The fixed lists of the school: tracks, course levels, assignment kinds, and the states that the pages show.
// The sample tables, the query files, the filters, and the badges read them.
// A later database holds the same values as check constraints.
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "~/shared/ui/badge";

/** A Badge variant of the kit. The state maps of this file use it. */
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** The subject areas of the school. Each course belongs to one. The label is `tracks.<track>`. */
export const TRACKS = [
	"design",
	"data",
	"development",
	"marketing",
	"business",
] as const;

/** One subject area. */
export type Track = (typeof TRACKS)[number];

/** The levels of a course, easiest first. The label is `levels.<level>`. */
export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

/** One course level. */
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** The states of a course, from its dates: before the first day, between the two days, after the last day. */
export const COURSE_STATUSES = ["running", "upcoming", "completed"] as const;

/** One course state. The label is `courses.statuses.<status>`. */
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** Badge variant per course state. Running is the only green one. */
export const COURSE_STATUS_BADGE = {
	running: "success",
	upcoming: "info",
	completed: "outline",
} satisfies Record<CourseStatus, BadgeVariant>;

/** The kinds of graded work. The label is `assignments.kinds.<kind>`. */
export const ASSIGNMENT_KINDS = ["project", "quiz", "essay", "lab"] as const;

/** One kind of graded work. */
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

/**
 * The states of a student in one course. "behind" and "on_track" apply while the course runs.
 * "certified" and "incomplete" apply after its last day. "enrolled" applies before its first day.
 */
export const LEARNER_STATES = [
	"on_track",
	"behind",
	"enrolled",
	"certified",
	"incomplete",
] as const;

/** One state of a student in a course. The label is `learners.states.<state>`. */
export type LearnerState = (typeof LEARNER_STATES)[number];

/** Badge variant per learner state. Behind is the only warning. */
export const LEARNER_STATE_BADGE = {
	on_track: "success",
	behind: "warning",
	enrolled: "info",
	certified: "secondary",
	incomplete: "outline",
} satisfies Record<LearnerState, BadgeVariant>;

/** The states of a student over all courses. The Students page filters by them. */
export const STUDENT_STATUSES = [
	"on_track",
	"behind",
	"starting",
	"graduated",
] as const;

/** One student state. The label is `students.statuses.<status>`. */
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** Badge variant per student state. */
export const STUDENT_STATUS_BADGE = {
	on_track: "success",
	behind: "warning",
	starting: "info",
	graduated: "secondary",
} satisfies Record<StudentStatus, BadgeVariant>;

/** The states of a submission. A grade moves it from "to_grade" to "graded". */
export const SUBMISSION_STATUSES = ["to_grade", "graded"] as const;

/** One submission state. The label is `assignments.statuses.<status>`. */
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** How long a submission waits for its grade: new, inside the target, or over the target. */
export const WAIT_BANDS = ["fresh", "waiting", "overdue"] as const;

/** One waiting band. The label is `grading.bands.<band>`. */
export type WaitBand = (typeof WAIT_BANDS)[number];

/** 5 days. The school promises a grade in this time. A longer wait is "overdue". */
export const GRADING_TARGET_DAYS = 5;

/** 2 days. A submission that waits less is "fresh". */
export const FRESH_WAIT_DAYS = 2;

/** 70 points of 100: the lowest grade of the "fair result" feedback band. Graded work at or above it passes. */
export const PASS_POINTS = 70;

/** 4 lessons. A student with this many released lessons not done is "behind". */
export const BEHIND_AFTER_LESSONS = 4;

/** 0.8. A student who did this share of the lessons gets the certificate of a finished course. */
export const CERTIFICATE_SHARE = 0.8;
