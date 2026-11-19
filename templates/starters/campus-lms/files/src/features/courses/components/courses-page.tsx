// The Courses page behind login, in the layout of the kit course page: the chosen course in two thirds
// (spotlight panel, instructor row, about and modules text) and the progress card and the course list in one third.
// The /app/courses route renders it after its loader, and also uses the skeleton and the error below.
// The page holds the chosen course and the state tab. The detail of the chosen course loads with useQuery.
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { type CourseStatus, fillMessage, PageError } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	courseQueryOptions,
	coursesQueryOptions,
	featuredCourseId,
} from "../api/courses.queries";
import { CourseAbout } from "./course-about";
import { CourseListCard } from "./course-list-card";
import { CourseProgressCard } from "./course-progress-card";
import { CourseSpotlight } from "./course-spotlight";
import { InstructorCard } from "./instructor-card";

// Two thirds and one third from 56rem of page width. One column below.
const PAGE_GRID = "grid gap-4 @4xl/main:grid-cols-3";

/** A click on a row of the list shows that course in the main column. */
export function CoursesPage() {
	const { t, locale } = useT();
	const { data: courses } = useSuspenseQuery(coursesQueryOptions());
	const [selectedId, setSelectedId] = useState(() => featuredCourseId(courses));
	const selected = courses.find((course) => course.id === selectedId);
	const [status, setStatus] = useState<CourseStatus>(
		selected?.status ?? "running",
	);
	// The loader fills the first course. Another course keeps the old text until its detail is ready.
	const detail = useQuery({
		...courseQueryOptions(selectedId ?? ""),
		enabled: selectedId !== undefined,
		placeholderData: keepPreviousData,
	});
	const number = new Intl.NumberFormat(locale);
	const countOf = (state: CourseStatus) =>
		number.format(courses.filter((course) => course.status === state).length);

	return (
		<div className="grid gap-4">
			<PageHeader
				title={t("courses.title")}
				description={fillMessage(t("courses.description"), {
					total: number.format(courses.length),
					running: countOf("running"),
					upcoming: countOf("upcoming"),
					completed: countOf("completed"),
				})}
			/>
			{selected === undefined ? (
				<p className="text-muted-foreground">{t("courses.empty")}</p>
			) : (
				<div className={PAGE_GRID}>
					<div className="@4xl/main:col-span-2 grid content-start gap-4">
						<CourseSpotlight course={selected} />
						{detail.isError ? (
							<div className="grid justify-items-start gap-3 rounded-surface border p-6">
								<p className="text-sm" role="alert">
									{t("courses.detailError")}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => detail.refetch()}
								>
									{t("common.retry")}
								</Button>
							</div>
						) : detail.data ? (
							<>
								<InstructorCard
									courseId={detail.data.id}
									instructor={detail.data.instructor}
								/>
								<CourseAbout course={detail.data} />
							</>
						) : (
							<>
								<Skeleton className="h-24" />
								<Skeleton className="h-64" />
							</>
						)}
					</div>
					<div className="grid content-start gap-4">
						{detail.data ? (
							<CourseProgressCard course={detail.data} />
						) : (
							<Skeleton className="h-64" />
						)}
						<CourseListCard
							courses={courses}
							status={status}
							onStatusChange={setStatus}
							selectedId={selectedId}
							onSelect={setSelectedId}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function CoursesPageSkeleton() {
	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className={PAGE_GRID}>
				<div className="@4xl/main:col-span-2 grid content-start gap-4">
					<Skeleton className="aspect-video" />
					<Skeleton className="h-24" />
				</div>
				<div className="grid content-start gap-4">
					<Skeleton className="h-64" />
					<Skeleton className="h-96" />
				</div>
			</div>
		</div>
	);
}

/** Error state when a course loader fails. The course page uses it too. */
export function CoursesPageError() {
	const { t } = useT();
	return <PageError message={t("courses.loadError")} />;
}
