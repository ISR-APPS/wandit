// The summary paragraph at the top of the home digest: one sentence per section, with the figure of its h2.
// OverviewPage renders it under the page header. It reads the same queries as the sections, so the figures agree.
// The figures sit on a marker of the secondary color, in the display face.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { submissionsQueryOptions } from "~/features/assignments";
import {
	FLAT_CHANGE,
	GRADING_TARGET_DAYS,
	type PeriodDays,
	totalsOf,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	dailyEnrollmentsQueryOptions,
	dailyLessonsQueryOptions,
} from "../api/overview.queries";

// Splits a message at its "{name}" places and puts a node in each one. A name with no value stays as text.
function fillParts(template: string, values: Record<string, ReactNode>) {
	return template.split(/(\{\w+\})/).map((part, index) => {
		const name = /^\{(\w+)\}$/.exec(part)?.[1];
		const value = name === undefined ? undefined : values[name];
		// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed message never reorder.
		return <Fragment key={index}>{value ?? part}</Fragment>;
	});
}

type FigureMarkProps = {
	/** The formatted figure. */
	children: ReactNode;
};

// One figure of the summary on its marker. dir="ltr" keeps a sign in front of the number in Arabic.
function FigureMark({ children }: FigureMarkProps) {
	return (
		<bdi
			dir="ltr"
			className="whitespace-nowrap rounded-sm bg-secondary px-1.5 font-numeric font-semibold text-secondary-foreground tabular-nums"
		>
			{children}
		</bdi>
	);
}

type DigestSummaryProps = {
	/** The period of the page, in days. */
	days: PeriodDays;
};

// True when the summary drops the comparison words: no earlier data, or a change that rounds to "0%".
function isFlat(change: number | null): boolean {
	return change === null || Math.abs(change) < FLAT_CHANGE;
}

/** Three sentences: lessons, the grading queue, and enrollments. A flat or null change drops the comparison words. */
export function DigestSummary({ days }: DigestSummaryProps) {
	const { t, locale } = useT();
	const lessons = useQuery({
		...dailyLessonsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const enrollments = useQuery({
		...dailyEnrollmentsQueryOptions(days),
		placeholderData: keepPreviousData,
	});
	const { data: submissions } = useSuspenseQuery(submissionsQueryOptions());

	// A failed query shows its error in its own section. The summary then waits with its skeleton.
	if (!lessons.data || !enrollments.data) {
		return <DigestSummarySkeleton />;
	}

	const number = new Intl.NumberFormat(locale);
	const change = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 1,
	});
	const lessonTotals = totalsOf(lessons.data);
	const enrollmentTotals = totalsOf(enrollments.data);
	const waiting = submissions.filter((row) => row.status === "to_grade");
	const overdue = waiting.filter((row) => row.waitBand === "overdue").length;

	const lessonsSentence = fillParts(
		t(
			isFlat(lessonTotals.change)
				? "overview.summaryLessonsFlat"
				: "overview.summaryLessons",
		),
		{
			lessons: <FigureMark>{number.format(lessonTotals.current)}</FigureMark>,
			change: (
				<FigureMark>{change.format(lessonTotals.change ?? 0)}</FigureMark>
			),
		},
	);
	const gradingSentence =
		waiting.length === 0
			? t("overview.summaryGradingNone")
			: fillParts(
					t(
						overdue === 0
							? "overview.summaryGradingOnTime"
							: "overview.summaryGrading",
					),
					{
						toGrade: <FigureMark>{number.format(waiting.length)}</FigureMark>,
						overdue: <FigureMark>{number.format(overdue)}</FigureMark>,
						target: number.format(GRADING_TARGET_DAYS),
					},
				);
	const enrollmentsSentence = fillParts(
		t(
			isFlat(enrollmentTotals.change)
				? "overview.summaryEnrollmentsFlat"
				: "overview.summaryEnrollments",
		),
		{
			enrollments: (
				<FigureMark>{number.format(enrollmentTotals.current)}</FigureMark>
			),
			change: (
				<FigureMark>{change.format(enrollmentTotals.change ?? 0)}</FigureMark>
			),
		},
	);

	return (
		<p className="max-w-prose font-display @xl/main:text-2xl text-xl @xl/main:leading-relaxed leading-relaxed">
			{lessonsSentence} {gradingSentence} {enrollmentsSentence}
		</p>
	);
}

/** Placeholder of the summary: three lines of the display size. */
export function DigestSummarySkeleton() {
	return (
		<div className="grid max-w-prose gap-3">
			<Skeleton className="h-7 w-full" />
			<Skeleton className="h-7 w-11/12" />
			<Skeleton className="h-7 w-2/3" />
		</div>
	);
}
