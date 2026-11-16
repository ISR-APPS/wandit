// The classes page behind login: the timetable of one day, the load of the week ahead, and the fill of each class.
// The /app/classes route renders it after its loader. The route also uses the skeleton and the error below.
// The URL holds the day (`?day=`) and the open session (`?session=`). The roster panel opens for that session.
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	FillMeter,
	SessionPhaseBadge,
	type SessionRow,
	STUDIOS,
	sessionPhaseAt,
	startOfLocalDay,
	toDayKey,
	useNow,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { Tabs, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import {
	classFillQueryOptions,
	classSessionsQueryOptions,
} from "../api/classes.queries";
import { timetableDays } from "../lib/class-fill";
import { ClassFillCard } from "./class-fill-card";
import { SessionRosterSheet } from "./session-roster-sheet";
import { WeekAheadCard } from "./week-ahead-card";

type ClassesPageProps = {
	/** The `day` search param, `YYYY-MM-DD`. An unknown day or none shows today. */
	dayKey?: string;
	/** The `session` search param: the id of the session whose roster is open. */
	sessionId?: string;
};

// The value of the studio Select that shows every studio.
const ALL_STUDIOS = "all";

/** A 2/3 column (the timetable and the week ahead) and a 1/3 fill rail from the 5xl container width. */
export function ClassesPage({ dayKey, sessionId }: ClassesPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const navigate = useNavigate();
	const { data: sessions } = useSuspenseQuery(classSessionsQueryOptions());
	const { data: fill } = useSuspenseQuery(classFillQueryOptions());
	const [studio, setStudio] = useState<
		(typeof STUDIOS)[number] | typeof ALL_STUDIOS
	>(ALL_STUDIOS);

	const days = timetableDays(startOfLocalDay(now));
	const activeDay = days.find((day) => day.key === dayKey) ?? days[0];
	const activeKey = activeDay?.key ?? toDayKey(now);
	const ofDay = sessions.filter((row) => toDayKey(row.startsAt) === activeKey);
	const rows =
		studio === ALL_STUDIOS
			? ofDay
			: ofDay.filter((row) => row.studio === studio);
	const openRow = sessions.find((row) => row.id === sessionId) ?? null;
	// Two formats, because the "en" pattern of { weekday, day } puts the day first: "15 Sun".
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("classes.title")}
				description={t("classes.description")}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Card>
						<CardHeader className="gap-4">
							<CardTitle>{t("classes.timetable")}</CardTitle>
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<Tabs
									value={activeKey}
									onValueChange={(value) =>
										navigate({
											to: "/app/classes",
											search: { day: value },
											replace: true,
										})
									}
									className="@md/main:w-auto w-full max-w-full"
								>
									{/* A phone shows the seven days in two rows of four, so no tab hides at the card edge. */}
									<TabsList
										aria-label={t("classes.day")}
										className="@md/main:flex grid @md/main:w-fit w-full grid-cols-4 @md/main:flex-wrap group-data-[orientation=horizontal]/tabs:h-auto"
									>
										{days.map((day) => {
											// The count follows the studio filter, so it equals the rows of the table under the tab.
											const count = sessions.filter(
												(row) =>
													toDayKey(row.startsAt) === day.key &&
													(studio === ALL_STUDIOS || row.studio === studio),
											).length;
											return (
												// A phone gets 44 px tabs for touch.
												<TabsTrigger
													key={day.key}
													value={day.key}
													className="@md/main:min-h-7.5 min-h-11"
												>
													{day === days[0]
														? t("classes.today")
														: `${weekday.format(day.start)} ${dayNumber.format(day.start)}`}
													<span className="rounded-badge bg-background px-1.5 text-foreground text-xs tabular-nums">
														{number.format(count)}
													</span>
												</TabsTrigger>
											);
										})}
									</TabsList>
								</Tabs>
								<Select
									value={studio}
									onValueChange={(value) =>
										setStudio(
											STUDIOS.find((name) => name === value) ?? ALL_STUDIOS,
										)
									}
								>
									<SelectTrigger
										className="w-40"
										aria-label={t("classes.studio")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={ALL_STUDIOS}>
											{t("classes.allStudios")}
										</SelectItem>
										{STUDIOS.map((name) => (
											<SelectItem key={name} value={name}>
												{name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</CardHeader>
						<CardContent>
							<TimetableTable rows={rows} now={now} dayKey={activeKey} />
						</CardContent>
					</Card>
					<WeekAheadCard
						days={days}
						sessions={sessions}
						activeKey={activeKey}
						now={now}
					/>
				</div>
				{/* The rail is shorter than the timetable column, so it stays in view during the scroll. */}
				<ClassFillCard
					rows={fill}
					className="@5xl/main:sticky @5xl/main:top-6"
				/>
			</div>
			<SessionRosterSheet
				row={openRow}
				now={now}
				onClose={() =>
					navigate({
						to: "/app/classes",
						search: { day: activeKey },
						replace: true,
					})
				}
			/>
		</div>
	);
}

type TimetableTableProps = {
	/** The sessions of one day after the studio filter, the earliest first. */
	rows: SessionRow[];
	/** The current time in milliseconds since 1970. */
	now: number;
	/** The day of the rows, kept in the link of each row. */
	dayKey: string;
};

// The sessions of one day. The class name opens the roster panel through the URL.
function TimetableTable({ rows, now, dayKey }: TimetableTableProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("classes.time")}</TableHead>
					<TableHead>{t("classes.class")}</TableHead>
					{/* A narrow panel drops the studio, waitlist, and status columns. The studio and status move under the class name. */}
					<TableHead className="@xl/main:table-cell hidden">
						{t("classes.studio")}
					</TableHead>
					<TableHead>{t("classes.booked")}</TableHead>
					<TableHead className="@xl/main:table-cell hidden text-end">
						{t("classes.waitlist")}
					</TableHead>
					<TableHead className="@xl/main:table-cell hidden text-end">
						{t("classes.status")}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.length === 0 ? (
					<TableRow>
						<TableCell
							colSpan={6}
							className="h-24 text-center text-muted-foreground"
						>
							{t("classes.noClasses")}
						</TableCell>
					</TableRow>
				) : (
					rows.map((row) => {
						const phase = sessionPhaseAt(row, now);
						return (
							<TableRow
								key={row.id}
								className={cn(phase === "done" && "text-muted-foreground")}
							>
								<TableCell className="whitespace-nowrap tabular-nums">
									{time.format(row.startsAt)}
								</TableCell>
								<TableCell className="whitespace-normal">
									<div className="grid justify-items-start">
										<Link
											to="/app/classes"
											search={{ day: dayKey, session: row.id }}
											className="font-medium text-foreground hover:underline"
										>
											{row.className}
										</Link>
										<span className="text-muted-foreground text-xs">
											{row.coachName}
											<span className="@xl/main:hidden">{` · ${row.studio}`}</span>
										</span>
										<SessionPhaseBadge
											phase={phase}
											className="mt-1.5 @xl/main:hidden"
										/>
									</div>
								</TableCell>
								<TableCell className="@xl/main:table-cell hidden whitespace-nowrap">
									{row.studio}
								</TableCell>
								<TableCell>
									<FillMeter
										booked={row.roster.length}
										capacity={row.capacity}
									/>
								</TableCell>
								<TableCell className="@xl/main:table-cell hidden text-end tabular-nums">
									{row.waitlistCount > 0
										? number.format(row.waitlistCount)
										: "–"}
								</TableCell>
								<TableCell className="@xl/main:table-cell hidden text-end">
									<SessionPhaseBadge phase={phase} />
								</TableCell>
							</TableRow>
						);
					})
				)}
			</TableBody>
		</Table>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4", "5", "6", "7"];

/** Placeholder while the classes loader runs: the header, the timetable, and the rail. */
export function ClassesPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<Card className="@5xl/main:col-span-2">
					<CardContent className="grid gap-3">
						<Skeleton className="h-9 w-full" />
						{SKELETON_ROWS.map((key) => (
							<Skeleton key={key} className="h-12 w-full" />
						))}
					</CardContent>
				</Card>
				<Skeleton className="h-[30rem]" />
			</div>
		</div>
	);
}

/** Error state of the classes page when the loader fails. Try again runs the loader again. */
export function ClassesPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("classes.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
