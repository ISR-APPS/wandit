// The page of one course, in the layout of the kit profile page: a back link, the title with the state and an export,
// then tabs. Overview holds the profile, open lessons, and topics cards beside the activity, assignments, and students cards.
// The other tabs hold the module list, the student table, and the assignment table.
// The /app/courses/$courseId route renders it after its loader. An unknown id shows a not-found card.
import { ArrowLeftIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { COURSE_STATUS_BADGE, downloadCsv, toCsv } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { courseQueryOptions } from "../api/courses.queries";
import { CourseActivityCard } from "./course-activity-card";
import { CourseLearnersCard } from "./course-learners-card";
import {
	CourseLearnersTable,
	learnerCsvColumns,
} from "./course-learners-table";
import { CourseModulesCard } from "./course-modules-card";
import { CourseOpenLessonsCard } from "./course-open-lessons-card";
import { CourseProfileCard } from "./course-profile-card";
import { CourseTopicsCard } from "./course-topics-card";
import { CourseWorkCard } from "./course-work-card";
import { CourseWorkTable } from "./course-work-table";

/** The tabs of the page. Each one has its own content. */
const TABS = ["overview", "modules", "students", "assignments"] as const;

type Tab = (typeof TABS)[number];

// One third and two thirds from 56rem of page width, as the kit profile.
const OVERVIEW_GRID = "grid gap-4 @4xl/main:grid-cols-3";

type CourseDetailPageProps = {
	/** The `$courseId` param of the URL: the slug of the course. The query treats an unknown slug as not found. */
	id: string;
};

/** The tab is state of the page, so the arrow of the students card can open the Students tab. */
export function CourseDetailPage({ id }: CourseDetailPageProps) {
	const { t } = useT();
	const { data: course } = useSuspenseQuery(courseQueryOptions(id));
	const [tab, setTab] = useState<Tab>("overview");

	const backLink = (
		<Link
			to="/app/courses"
			className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
		>
			<ArrowLeftIcon className="size-4 rtl:rotate-180" />
			{t("courses.back")}
		</Link>
	);
	if (!course) {
		return (
			<div className="grid gap-4">
				{backLink}
				<Card className="max-w-lg">
					<CardHeader>
						<CardTitle>{t("courses.notFoundTitle")}</CardTitle>
						<CardDescription>{t("courses.notFound")}</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild variant="outline">
							<Link to="/app/courses">{t("courses.backToList")}</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={course.title}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<Badge variant={COURSE_STATUS_BADGE[course.status]}>
							{t(`courses.statuses.${course.status}`)}
						</Badge>
						{`${course.code} · ${t(`tracks.${course.track}`)}`}
					</span>
				}
				actions={
					<Button
						type="button"
						aria-label={t("courses.exportStudents")}
						onClick={() =>
							downloadCsv(
								`${course.code}-students.csv`,
								toCsv(
									course.learners,
									learnerCsvColumns(t, course.lessonCount),
								),
							)
						}
					>
						<DownloadSimpleIcon />
						<span className="hidden lg:inline">
							{t("courses.exportStudents")}
						</span>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) => {
					const next = TABS.find((item) => item === value);
					if (next) {
						setTab(next);
					}
				}}
				className="gap-4"
			>
				<div className="overflow-x-auto">
					<TabsList>
						{TABS.map((item) => (
							<TabsTrigger key={item} value={item}>
								{t(`courses.tabs.${item}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
				<TabsContent value="overview">
					<div className={OVERVIEW_GRID}>
						<div className="grid content-start gap-4">
							<CourseProfileCard course={course} />
							<CourseOpenLessonsCard
								released={course.lessonsReleased}
								total={course.lessonCount}
							/>
							<CourseTopicsCard
								topics={course.modules.map((module) => module.title)}
							/>
						</div>
						<div className="@4xl/main:col-span-2 grid content-start gap-4">
							<CourseActivityCard events={course.events} />
							<div className="grid @4xl/main:grid-cols-2 gap-4">
								<CourseWorkCard assignments={course.assignments} />
								<CourseLearnersCard
									learners={course.learners}
									onShowAll={() => setTab("students")}
								/>
							</div>
						</div>
					</div>
				</TabsContent>
				<TabsContent value="modules">
					<CourseModulesCard modules={course.modules} />
				</TabsContent>
				<TabsContent value="students">
					<CourseLearnersTable
						learners={course.learners}
						lessonCount={course.lessonCount}
						courseCode={course.code}
					/>
				</TabsContent>
				<TabsContent value="assignments">
					<CourseWorkTable
						assignments={course.assignments}
						enrolled={course.enrolled}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function CourseDetailPageSkeleton() {
	return (
		<div className="grid gap-4">
			<Skeleton className="h-4 w-24" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-72 max-w-full" />
				<Skeleton className="h-5 w-48" />
			</div>
			<Skeleton className="h-9 w-80 max-w-full" />
			<div className={OVERVIEW_GRID}>
				<Skeleton className="h-112" />
				<Skeleton className="@4xl/main:col-span-2 h-112" />
			</div>
		</div>
	);
}
