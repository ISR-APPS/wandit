// The table card of the home: every assignment of the running courses that is due today or later.
// DashboardPage renders it beside the lessons card. The /app loader prefetches dueAssignmentsQueryOptions.
// A row with work to grade shows a "Grade" button that opens the oldest waiting work; the other rows show a menu.
import {
	ArticleIcon,
	CalendarBlankIcon,
	DotsThreeIcon,
	FlaskIcon,
	FolderSimpleIcon,
	ListChecksIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	dueAssignmentsQueryOptions,
	type UpcomingAssignment,
} from "~/features/assignments";
import {
	type AssignmentKind,
	copyToClipboard,
	fillMessage,
} from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/shared/ui/dropdown-menu";
import { CaretRightIcon, type KitIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { type RecordColumn, RecordTable } from "~/shared/ui/record-table";

/** The icon of each kind of work. The tile stands where the kit shows a course logo. */
const KIND_ICON = {
	project: FolderSimpleIcon,
	quiz: ListChecksIcon,
	essay: ArticleIcon,
	lab: FlaskIcon,
} satisfies Record<AssignmentKind, KitIcon>;

// Six rows per page, as the kit card.
const PAGE_SIZE = 6;

/** Search, sort, and pages work in the browser through RecordTable. */
export function DueAssignmentsCard() {
	const { t, locale } = useT();
	const { data: assignments } = useSuspenseQuery(dueAssignmentsQueryOptions());
	const number = new Intl.NumberFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	const columns: RecordColumn<UpcomingAssignment>[] = [
		{
			id: "assignment",
			header: t("dashboard.assignment"),
			sortValue: (row) => row.title,
			cell: (row) => {
				const KindIcon = KIND_ICON[row.kind];
				return (
					<div className="flex items-center gap-3">
						<span
							aria-hidden="true"
							className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
						>
							<KindIcon className="size-4" />
						</span>
						<span className="grid">
							<span className="font-medium">{row.title}</span>
							<span className="text-muted-foreground text-xs">
								{`${t(`assignments.kinds.${row.kind}`)} · ${row.courseCode}`}
							</span>
						</span>
					</div>
				);
			},
		},
		{
			id: "due",
			header: t("dashboard.due"),
			sortValue: (row) => row.dueAt,
			cell: (row) => (
				<span className="flex items-center gap-1.5 tabular-nums">
					<CalendarBlankIcon
						aria-hidden="true"
						className="size-4 text-muted-foreground"
					/>
					{shortDate.format(new Date(row.dueAt))}
				</span>
			),
		},
		{
			id: "turnedIn",
			header: t("dashboard.turnedIn"),
			sortValue: (row) =>
				row.expected === 0 ? 0 : row.submitted / row.expected,
			cell: (row) => {
				const label = fillMessage(t("dashboard.turnedInOf"), {
					submitted: number.format(row.submitted),
					expected: number.format(row.expected),
				});
				return (
					<Progress
						value={row.submitted}
						max={row.expected}
						aria-label={label}
						title={label}
						className="w-16"
					/>
				);
			},
		},
		{
			id: "action",
			header: t("table.actions"),
			align: "end",
			cell: (row) =>
				row.oldestWaitingId ? (
					<Button size="sm" asChild>
						<Link
							to="/app/assignments"
							search={{ submission: row.oldestWaitingId }}
						>
							{fillMessage(t("dashboard.grade"), {
								count: number.format(row.toGrade),
							})}
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label={t("table.rowActions")}
							>
								<DotsThreeIcon className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-40">
							<DropdownMenuItem asChild>
								<Link
									to="/app/courses/$courseId"
									params={{ courseId: row.courseId }}
								>
									{t("dashboard.openCourse")}
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() =>
									copyToClipboard(row.id, {
										done: t("table.copied"),
										failed: t("table.copyFailed"),
									})
								}
							>
								{t("table.copyId")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.dueTitle")}</CardTitle>
				<CardDescription>{t("dashboard.dueDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<RecordTable
					rows={assignments}
					columns={columns}
					searchText={(row) => `${row.title} ${row.courseCode}`}
					searchPlaceholder={t("dashboard.dueSearch")}
					pageSize={PAGE_SIZE}
					noResults={t("dashboard.noDue")}
				/>
			</CardContent>
		</Card>
	);
}
