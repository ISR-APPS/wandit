// The classes page behind login, in the anatomy of the kit calendar page: one card with the week controls,
// the weekday row, and 7 day columns of class chips. A chip opens the roster panel of its session.
// The /app/classes route renders it after its loader. The route also uses the skeleton and the error below.
// The URL holds the week (`?day=`, any day of it) and the open session (`?session=`).
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	addDays,
	CLASS_TYPES,
	type ClassTypeId,
	downloadCsv,
	fillMessage,
	type SessionRow,
	type Studio,
	startOfLocalDay,
	toCsv,
	toDayKey,
	useNow,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretLeftIcon, CaretRightIcon } from "~/shared/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { classWeekQueryOptions } from "../api/classes.queries";
import {
	dayKeyToStart,
	WEEK_LENGTH,
	weekDays,
	weekKeyFor,
	weekRange,
} from "../lib/week";
import { SessionRosterSheet } from "./session-roster-sheet";

/** The chip colors of each room. The chip also names the room, so the color is never the only mark. */
const STUDIO_CHIP = {
	"Main Floor": "border-chart-1 bg-chart-1/15",
	"Cycle Room": "border-chart-2 bg-chart-2/15",
	"Studio Two": "border-chart-3 bg-chart-3/15",
	"Mat Room": "border-chart-4 bg-chart-4/15",
} satisfies Record<Studio, string>;

// The value of the class Select that shows every class.
const ALL_CLASSES = "all";

type ClassesPageProps = {
	/** The `day` search param, `YYYY-MM-DD`. The page shows its week. None, or a day outside the sample, shows this week. */
	dayKey?: string;
	/** The `session` search param: the id of the session whose roster is open. */
	sessionId?: string;
};

/** The calendar scrolls sideways inside its card on a phone, never the page. */
export function ClassesPage({ dayKey, sessionId }: ClassesPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const navigate = useNavigate();
	const weekKey = weekKeyFor(dayKey, now);
	const { data: sessions } = useSuspenseQuery(classWeekQueryOptions(weekKey));
	const [classTypeId, setClassTypeId] = useState<
		ClassTypeId | typeof ALL_CLASSES
	>(ALL_CLASSES);

	const todayStart = startOfLocalDay(now);
	const weekStart = dayKeyToStart(weekKey);
	const days = weekDays(weekStart);
	const range = weekRange(todayStart);
	const shown =
		classTypeId === ALL_CLASSES
			? sessions
			: sessions.filter((row) => row.classTypeId === classTypeId);
	const openRow = sessions.find((row) => row.id === sessionId) ?? null;
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const weekLabel = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).formatRange(days[0] ?? weekStart, days[WEEK_LENGTH - 1] ?? weekStart);
	const number = new Intl.NumberFormat(locale);

	function showWeek(start: number) {
		navigate({ to: "/app/classes", search: { day: toDayKey(start) } });
	}

	return (
		<div className="grid gap-4">
			<Card className="gap-0 overflow-hidden py-0">
				<div className="flex flex-wrap items-center gap-2 p-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/app/classes", search: {} })}
					>
						{t("classes.today")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("classes.previousWeek")}
						disabled={weekStart <= range.first}
						onClick={() => showWeek(addDays(weekStart, -WEEK_LENGTH))}
					>
						<CaretLeftIcon className="rtl:rotate-180" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t("classes.nextWeek")}
						disabled={weekStart >= range.last}
						onClick={() => showWeek(addDays(weekStart, WEEK_LENGTH))}
					>
						<CaretRightIcon className="rtl:rotate-180" />
					</Button>
					<h1 className="font-(--heading-weight) font-display @2xl/main:text-2xl text-xl tracking-(--heading-tracking)">
						{weekLabel}
					</h1>
					<div className="ms-auto flex flex-wrap items-center gap-2">
						<Select
							value={classTypeId}
							onValueChange={(value) =>
								setClassTypeId(
									CLASS_TYPES.find((row) => row.id === value)?.id ??
										ALL_CLASSES,
								)
							}
						>
							<SelectTrigger
								aria-label={t("classes.classFilter")}
								className="w-44"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value={ALL_CLASSES}>
									{t("classes.allClasses")}
								</SelectItem>
								{CLASS_TYPES.map((row) => (
									<SelectItem key={row.id} value={row.id}>
										{row.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							aria-label={t("classes.exportWeek")}
							onClick={() =>
								downloadCsv(
									`classes-${weekKey}.csv`,
									toCsv(shown, [
										{
											header: t("classes.date"),
											value: (row) => toDayKey(row.startsAt),
										},
										{
											header: t("classes.time"),
											value: (row) => time.format(row.startsAt),
										},
										{
											header: t("classes.class"),
											value: (row) => row.className,
										},
										{
											header: t("classes.coach"),
											value: (row) => row.coachName,
										},
										{ header: t("classes.studio"), value: (row) => row.studio },
										{
											header: t("classes.booked"),
											value: (row) => String(row.roster.length),
										},
										{
											header: t("classes.capacity"),
											value: (row) => String(row.capacity),
										},
										{
											header: t("classes.cancelled"),
											value: (row) => (row.isCancelled ? t("classes.yes") : ""),
										},
									]),
								)
							}
						>
							<DownloadSimpleIcon />
							<span className="hidden lg:inline">
								{t("classes.exportWeek")}
							</span>
						</Button>
					</div>
				</div>
				<div className="overflow-x-auto border-t">
					<div className="grid min-w-4xl grid-cols-7">
						{days.map((dayStart) => (
							<div
								key={dayStart}
								className="border-b py-3 text-center text-muted-foreground text-sm"
							>
								{weekday.format(dayStart)}
							</div>
						))}
						{days.map((dayStart, index) => {
							const ofDay = shown.filter(
								(row) =>
									row.startsAt >= dayStart &&
									row.startsAt < addDays(dayStart, 1),
							);
							const isToday = dayStart === todayStart;
							// 40rem columns let the card fill a laptop screen, as the kit calendar does.
							// "relative" keeps the absolute sr-only "today" text inside the scroll box. Else the page scrolls sideways on a phone.
							return (
								<div
									key={dayStart}
									className={cn(
										"relative grid min-h-160 content-start gap-1.5 p-2",
										index > 0 && "border-s",
									)}
								>
									<span
										className={cn(
											"mb-1 flex size-7 items-center justify-center text-sm tabular-nums",
											isToday &&
												"rounded-full bg-primary font-semibold text-primary-foreground",
											dayStart < todayStart && "text-muted-foreground",
										)}
									>
										{dayNumber.format(dayStart)}
										{isToday ? (
											<span className="sr-only">{` ${t("classes.today")}`}</span>
										) : null}
									</span>
									{ofDay.length === 0 ? (
										<span className="px-1 text-muted-foreground text-xs">
											{t("classes.noClassDay")}
										</span>
									) : (
										ofDay.map((row) => (
											<ClassChip
												key={row.id}
												row={row}
												time={time.format(row.startsAt)}
												fill={fillMessage(t("classes.fill"), {
													booked: number.format(row.roster.length),
													capacity: number.format(row.capacity),
												})}
												isPast={row.endsAt <= now}
												onOpen={() =>
													navigate({
														to: "/app/classes",
														search: { day: weekKey, session: row.id },
													})
												}
											/>
										))
									)}
								</div>
							);
						})}
					</div>
				</div>
			</Card>
			<SessionRosterSheet
				row={openRow}
				now={now}
				onClose={() =>
					navigate({
						to: "/app/classes",
						search: { day: weekKey },
						replace: true,
					})
				}
			/>
		</div>
	);
}

type ClassChipProps = {
	row: SessionRow;
	/** The start time, already formatted. */
	time: string;
	/** "12 / 16", already formatted. */
	fill: string;
	/** The class ended. Its chip loses the studio tint, but the text keeps full contrast. */
	isPast: boolean;
	/** Opens the roster panel of the session. */
	onOpen: () => void;
};

// One class of a day column: the time and the name, then the fill and the room. A cancelled class is struck out.
function ClassChip({ row, time, fill, isPast, onOpen }: ClassChipProps) {
	const { t } = useT();
	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"grid w-full gap-0.5 rounded-md border-s px-2 py-1 text-start text-xs hover:brightness-110",
				STUDIO_CHIP[row.studio],
				isPast && "bg-muted",
				row.isCancelled && "text-muted-foreground line-through",
			)}
		>
			{/* A long class name wraps under the time, so the full name always shows. */}
			<span className="flex min-w-0 flex-wrap gap-x-1">
				<span className="shrink-0 text-muted-foreground tabular-nums">
					{time}
				</span>
				<span className="font-medium">{row.className}</span>
			</span>
			<span className="text-muted-foreground tabular-nums">
				{row.isCancelled ? t("classes.cancelled") : `${fill} · ${row.studio}`}
			</span>
		</button>
	);
}

// Placeholder keys of the 7 day columns. Fixed keys, because the columns never reorder.
const SKELETON_DAYS = ["1", "2", "3", "4", "5", "6", "7"];

/** Placeholder while the loader runs. The route sets it as pendingComponent. */
export function ClassesPageSkeleton() {
	return (
		<Card className="gap-4 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-9 w-20" />
				<Skeleton className="h-9 w-20" />
				<Skeleton className="h-8 w-64" />
			</div>
			<div className="grid grid-cols-7 gap-2">
				{SKELETON_DAYS.map((key) => (
					<Skeleton key={key} className="h-160" />
				))}
			</div>
		</Card>
	);
}

/** Error state when the loader fails. Try again runs the loader again. */
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
