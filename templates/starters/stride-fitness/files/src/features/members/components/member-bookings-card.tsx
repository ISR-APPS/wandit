// The bookings card of the member page: the classes ahead that the member booked, each with a roster link.
// MemberDetailPage renders it beside the payments card. It follows the connections card of the kit profile page.
import { CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type SessionRow, toDayKey } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type MemberBookingsCardProps = {
	/** The booked classes ahead, the earliest first. */
	sessions: SessionRow[];
};

/** "Roster" opens the class in the week calendar of the classes page. */
export function MemberBookingsCard({ sessions }: MemberBookingsCardProps) {
	const { t, locale } = useT();
	const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.bookingsTitle")}</CardTitle>
				<CardAction>
					<Button
						asChild
						variant="outline"
						size="icon"
						className="size-8"
						aria-label={t("classes.title")}
					>
						<Link to="/app/classes">
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noBookings")}
					</p>
				) : (
					<ul className="grid gap-4">
						{sessions.map((session) => (
							<li key={session.id} className="flex items-center gap-3">
								<span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-full bg-muted leading-none">
									<span className="font-numeric font-semibold text-sm tabular-nums">
										{day.format(session.startsAt)}
									</span>
									<span className="text-muted-foreground text-xs">
										{weekday.format(session.startsAt)}
									</span>
								</span>
								<div className="grid min-w-0 flex-1">
									<span className="truncate font-medium text-sm">
										{session.className}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{`${time.format(session.startsAt)} · ${session.coachName}`}
									</span>
								</div>
								<Button asChild variant="outline" size="sm">
									<Link
										to="/app/classes"
										search={{
											day: toDayKey(session.startsAt),
											session: session.id,
										}}
									>
										{t("members.roster")}
									</Link>
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
