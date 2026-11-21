// The classes card of the home: each class of today with its coach, its phase, and its fill as a bar.
// DashboardPage renders it in the second row. A class name opens its roster on the classes page.
// It follows recipe 3.3 of the kit system (a list with progress bars) and the workouts card of the kit fitness page.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	SessionPhaseBadge,
	type SessionRow,
	sessionPhaseAt,
	toDayKey,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type TodaysClassesCardProps = {
	/** The sessions of today, the earliest first. */
	sessions: SessionRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The text gives the fill, so the bar is hidden from screen readers. */
export function TodaysClassesCard({ sessions, now }: TodaysClassesCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.classesTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.classesDescription"), {
						count: number.format(sessions.length),
					})}
				</CardDescription>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/classes">
							{t("common.viewAll")}
							<ArrowRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("dashboard.noClasses")}
					</p>
				) : (
					<ul className="grid gap-4">
						{sessions.map((session) => (
							<li key={session.id} className="grid gap-1.5">
								<div className="flex items-center justify-between gap-3">
									<div className="grid min-w-0">
										<Link
											to="/app/classes"
											search={{
												day: toDayKey(session.startsAt),
												session: session.id,
											}}
											className="truncate font-medium text-sm hover:underline"
										>
											{session.className}
										</Link>
										<span className="truncate text-muted-foreground text-xs tabular-nums">
											{`${time.format(session.startsAt)} · ${session.coachName}`}
										</span>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<span className="text-sm tabular-nums">
											{fillMessage(t("classes.fill"), {
												booked: number.format(session.roster.length),
												capacity: number.format(session.capacity),
											})}
										</span>
										<SessionPhaseBadge phase={sessionPhaseAt(session, now)} />
									</div>
								</div>
								<Progress
									value={session.roster.length}
									max={session.capacity}
									aria-hidden="true"
									className="h-2"
								/>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
