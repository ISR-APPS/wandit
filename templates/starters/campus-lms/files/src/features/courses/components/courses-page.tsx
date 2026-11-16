// The course list behind login: the page header, the state filter, the track filter, and one card per course.
// The /app/courses route renders it after its loader. The routes of the courses also use the skeleton and the error below.
// A filter with no match shows one line and a button that clears the filters.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	COURSE_STATUSES,
	type CourseStatus,
	fillMessage,
	PageError,
	StatusFilter,
	TRACKS,
	type Track,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { coursesQueryOptions } from "../api/courses.queries";
import { CourseCard } from "./course-card";

// The cards of the page. Two columns from a medium page, three on a wide one.
const CARD_GRID = "grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3";

/** The state filter and the track filter narrow the cards. The state counts follow the track filter. */
export function CoursesPage() {
	const { t, locale } = useT();
	const { data: courses } = useSuspenseQuery(coursesQueryOptions());
	const [status, setStatus] = useState<CourseStatus | "all">("all");
	const [track, setTrack] = useState<Track | "all">("all");
	const number = new Intl.NumberFormat(locale);

	const inTrack =
		track === "all" ? courses : courses.filter((row) => row.track === track);
	const shown =
		status === "all" ? inTrack : inTrack.filter((row) => row.status === status);
	const countOf = (value: CourseStatus) =>
		courses.filter((row) => row.status === value).length;
	const statusOptions = [
		{ value: "all" as const, label: t("common.all"), count: inTrack.length },
		...COURSE_STATUSES.map((value) => ({
			value,
			label: t(`courses.statuses.${value}`),
			count: inTrack.filter((row) => row.status === value).length,
		})),
	];

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("courses.title")}
				description={fillMessage(t("courses.description"), {
					total: number.format(courses.length),
					running: number.format(countOf("running")),
					upcoming: number.format(countOf("upcoming")),
					completed: number.format(countOf("completed")),
				})}
			/>
			{/* On a phone the two selects share one row. */}
			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
				<StatusFilter
					options={statusOptions}
					value={status}
					onValueChange={setStatus}
				/>
				<Select
					value={track}
					onValueChange={(value) =>
						setTrack(TRACKS.find((option) => option === value) ?? "all")
					}
				>
					<SelectTrigger
						aria-label={t("courses.track")}
						className="max-sm:h-11 sm:w-40"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("courses.allTracks")}</SelectItem>
						{TRACKS.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`tracks.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{shown.length === 0 ? (
				<Card>
					<CardContent className="grid justify-items-center gap-3 py-10 text-center">
						<p className="text-muted-foreground text-sm">
							{t("courses.noResults")}
						</p>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								setStatus("all");
								setTrack("all");
							}}
						>
							{t("common.clearFilters")}
						</Button>
					</CardContent>
				</Card>
			) : (
				<ul className={CARD_GRID}>
					{shown.map((course) => (
						<li key={course.id} className="grid">
							<CourseCard course={course} />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// Placeholder cards of the skeleton. Fixed keys, because the cards never reorder.
const SKELETON_CARDS = ["1", "2", "3", "4", "5", "6"];

/** Placeholder while the list loader runs: the header, the filters, and six cards. */
export function CoursesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-96 max-w-full" />
				<Skeleton className="h-9 w-40" />
			</div>
			<div className={CARD_GRID}>
				{SKELETON_CARDS.map((key) => (
					<Skeleton key={key} className="h-64 rounded-surface" />
				))}
			</div>
		</div>
	);
}

/** Error state of the course routes when a loader fails. Try again runs the loader again. */
export function CoursesPageError() {
	const { t } = useT();
	return <PageError message={t("courses.loadError")} />;
}
