// The course list of the Courses page: state tabs and one boxed row per course. A row picks the course of the page.
// CoursesPage renders it in the end column, where the kit course page lists its modules.
// The page holds the chosen course and the tab; this card reads them from its props.
import {
	CheckIcon,
	ClockIcon,
	type Icon,
	PlayIcon,
} from "@phosphor-icons/react";
import {
	COURSE_STATUSES,
	type CourseStatus,
	fillMessage,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import type { Course } from "../api/courses.queries";

/** The mark of each state in the round icon. The chosen row always shows the play mark on the primary color. */
const STATUS_MARK = {
	running: { icon: PlayIcon, className: "bg-muted" },
	upcoming: { icon: ClockIcon, className: "bg-muted" },
	completed: { icon: CheckIcon, className: "bg-success/15 text-success" },
} satisfies Record<CourseStatus, { icon: Icon; className: string }>;

type CourseListCardProps = {
	/** Every course, from the list query. */
	courses: Course[];
	/** The state tab that is open. */
	status: CourseStatus;
	onStatusChange: (status: CourseStatus) => void;
	/** The id of the chosen course. */
	selectedId: string | undefined;
	onSelect: (courseId: string) => void;
};

/** The count at the end of the header names the finished courses of all courses, where the kit shows "1/25". */
export function CourseListCard({
	courses,
	status,
	onStatusChange,
	selectedId,
	onSelect,
}: CourseListCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const completed = courses.filter((course) => course.status === "completed");
	const shown = courses.filter((course) => course.status === status);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("courses.allCourses")}</CardTitle>
				<CardAction>
					<span className="text-muted-foreground text-sm tabular-nums">
						{fillMessage(t("courses.completedCount"), {
							done: number.format(completed.length),
							total: number.format(courses.length),
						})}
					</span>
				</CardAction>
			</CardHeader>
			<CardContent className="grid gap-4">
				<Tabs
					value={status}
					onValueChange={(value) => {
						const next = COURSE_STATUSES.find((item) => item === value);
						if (next) {
							onStatusChange(next);
						}
					}}
				>
					<TabsList className="w-full">
						{COURSE_STATUSES.map((item) => (
							<TabsTrigger key={item} value={item}>
								{t(`courses.tabs.${item}`)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
				{shown.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("courses.noResults")}
					</p>
				) : (
					<ul className="grid gap-2">
						{shown.map((course) => {
							const isSelected = course.id === selectedId;
							const mark = STATUS_MARK[course.status];
							const MarkIcon = isSelected ? PlayIcon : mark.icon;
							return (
								<li key={course.id}>
									<button
										type="button"
										aria-pressed={isSelected}
										onClick={() => onSelect(course.id)}
										className={cn(
											"flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-muted",
											isSelected &&
												"border-primary bg-primary/5 hover:bg-primary/10",
										)}
									>
										<span
											aria-hidden="true"
											className={cn(
												"flex size-8 shrink-0 items-center justify-center rounded-full",
												isSelected
													? "bg-primary text-primary-foreground"
													: mark.className,
											)}
										>
											<MarkIcon className="size-4 rtl:-scale-x-100" />
										</span>
										<span className="grid min-w-0 flex-1">
											<span className="font-medium">{course.title}</span>
											<span className="text-muted-foreground text-sm">
												{`${course.code} · ${fillMessage(t("courses.weeks"), {
													weeks: number.format(course.weeks),
												})}`}
											</span>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
