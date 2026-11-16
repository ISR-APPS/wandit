// The main block of the home: today's classes as a timeline, with a now line between the past and the next class.
// TodayPage renders it with the session rows of today. Each row opens the roster of its class on the classes page.
// Ended classes are muted. The class on the floor carries the live badge in the accent color.
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import {
	FillMeter,
	MemberAvatar,
	SessionPhaseBadge,
	type SessionRow,
	sessionPhaseAt,
	toDayKey,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";

type AgendaCardProps = {
	/** The sessions of today, the earliest first. */
	rows: SessionRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The grid span of the home page. */
	className?: string;
};

// The avatars of a row. More would crowd the row at the lg width.
const AVATAR_COUNT = 4;

/** A timeline of the day. A day with no class keeps the frame, the now line, and one muted sentence. */
export function AgendaCard({ rows, now, className }: AgendaCardProps) {
	const { t, locale } = useT();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);
	// The now line sits above the first class that has not started.
	const nextIndex = rows.findIndex((row) => row.startsAt > now);
	const nowLine = (
		<li aria-hidden="true" className="flex items-center gap-3 py-1">
			<span className="w-16 shrink-0 font-medium text-xs tabular-nums">
				{time.format(now)}
			</span>
			<span className="h-px flex-1 bg-ring" />
			<span className="label-text text-xs">{t("today.now")}</span>
		</li>
	);

	return (
		// The card is a container: the avatar stack shows only when the agenda itself is wide.
		<Card className={cn("@container/agenda", className)}>
			<CardHeader>
				<CardTitle>{t("today.agendaTitle")}</CardTitle>
				<CardDescription>
					<span className="tabular-nums">{number.format(rows.length)}</span>
					{` ${t("today.agendaDescription")}`}
				</CardDescription>
				<CardAction>
					<Link
						to="/app/classes"
						className="inline-flex min-h-11 items-center gap-1.5 font-medium text-sm hover:underline"
					>
						{t("today.seeTimetable")}
						<ArrowRightIcon className="size-4 rtl:rotate-180" />
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-6">
				{rows.length === 0 ? (
					<ul className="grid gap-3">
						{nowLine}
						<li className="py-8 text-center text-muted-foreground text-sm">
							{t("today.noClasses")}
						</li>
					</ul>
				) : (
					<ul className="grid">
						{rows.map((row, index) => {
							const phase = sessionPhaseAt(row, now);
							return (
								<Fragment key={row.id}>
									{index === nextIndex ? nowLine : null}
									<li className="border-b last:border-b-0">
										<Link
											to="/app/classes"
											search={{ day: toDayKey(row.startsAt), session: row.id }}
											className={cn(
												"group flex items-center gap-3 py-4",
												(phase === "done" || phase === "cancelled") &&
													"text-muted-foreground",
											)}
										>
											<span className="grid w-16 shrink-0 tabular-nums leading-tight">
												<span className="font-medium text-sm">
													{time.format(row.startsAt)}
												</span>
												<span className="text-muted-foreground text-xs">
													{time.format(row.endsAt)}
												</span>
											</span>
											<span className="grid min-w-0 flex-1">
												<span
													className={cn(
														"truncate font-medium group-hover:underline",
														phase !== "done" &&
															phase !== "cancelled" &&
															"text-foreground",
													)}
												>
													{row.className}
												</span>
												<span className="truncate text-muted-foreground text-xs">
													{`${row.coachName} · ${row.studio}`}
												</span>
											</span>
											<RosterStack row={row} />
											<FillMeter
												booked={row.roster.length}
												capacity={row.capacity}
												className="@md/main:grid hidden"
											/>
											<span className="grid w-16 shrink-0 justify-items-end gap-1">
												<SessionPhaseBadge phase={phase} className="w-16" />
												{/* A phone hides the meter, so the booked count moves under the badge. */}
												<span className="@md/main:hidden text-muted-foreground text-xs tabular-nums">
													{`${number.format(row.roster.length)} / ${number.format(row.capacity)}`}
												</span>
											</span>
										</Link>
									</li>
								</Fragment>
							);
						})}
						{nextIndex === -1 ? nowLine : null}
					</ul>
				)}
				<CoachesStrip rows={rows} />
			</CardContent>
		</Card>
	);
}

type RosterStackProps = {
	/** The session whose first booked members show. */
	row: SessionRow;
};

// The first booked members as overlapping initials, and the count of the others.
// It shows from an agenda width of 38rem, so the class name and the studio keep their room.
function RosterStack({ row }: RosterStackProps) {
	const { locale } = useT();
	const number = new Intl.NumberFormat(locale, { signDisplay: "always" });
	const others = row.roster.length - AVATAR_COUNT;
	if (row.roster.length === 0) {
		return null;
	}
	return (
		<span
			aria-hidden="true"
			className="@min-[38rem]/agenda:flex hidden items-center"
		>
			{row.roster.slice(0, AVATAR_COUNT).map((entry) => (
				<MemberAvatar
					key={entry.memberId}
					name={entry.fullName}
					className="-ms-1.5 ring-2 ring-card first:ms-0"
				/>
			))}
			{others > 0 ? (
				<span className="ms-1.5 w-8 text-muted-foreground text-xs tabular-nums">
					{number.format(others)}
				</span>
			) : (
				<span className="ms-1.5 w-8" />
			)}
		</span>
	);
}

type CoachesStripProps = {
	/** The sessions of today. A cancelled session does not count for its coach. */
	rows: SessionRow[];
};

// The coaches who teach today, in the order of their first class, with their count of classes.
function CoachesStrip({ rows }: CoachesStripProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const classCountOf = new Map<string, number>();
	for (const row of rows.filter((session) => !session.isCancelled)) {
		classCountOf.set(row.coachName, (classCountOf.get(row.coachName) ?? 0) + 1);
	}
	if (classCountOf.size === 0) {
		return null;
	}
	return (
		<section
			className="mt-auto grid gap-3 border-t pt-5"
			aria-label={t("today.coachesTitle")}
		>
			<h2 className="label-text text-muted-foreground text-xs">
				{t("today.coachesTitle")}
			</h2>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-3">
				{[...classCountOf].map(([coachName, count]) => (
					<li key={coachName} className="flex items-center gap-2.5">
						<MemberAvatar name={coachName} />
						<span className="grid leading-tight">
							<span className="font-medium text-sm">{coachName}</span>
							<span className="text-muted-foreground text-xs">
								<span className="tabular-nums">{number.format(count)}</span>
								{` ${t(count === 1 ? "today.classOne" : "today.classMany")}`}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
