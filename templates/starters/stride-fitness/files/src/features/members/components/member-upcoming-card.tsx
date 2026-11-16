// The rail panel of the member page with the classes that the member booked in the week ahead.
// MemberDetailPage renders it with the upcoming sessions of memberQueryOptions.
// Each line links to the roster of that session on the classes page.
import { Link } from "@tanstack/react-router";
import { type SessionRow, toDayKey } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type MemberUpcomingCardProps = {
	/** Booked sessions ahead, the earliest first. */
	sessions: SessionRow[];
};

/** A date block and the class of each booking. No booking shows one muted sentence. */
export function MemberUpcomingCard({ sessions }: MemberUpcomingCardProps) {
	const { t, locale } = useT();
	const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.upcoming")}</CardTitle>
			</CardHeader>
			<CardContent>
				{sessions.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noUpcoming")}
					</p>
				) : (
					<ul className="grid gap-3">
						{sessions.map((session) => (
							<li key={session.id}>
								<Link
									to="/app/classes"
									search={{
										day: toDayKey(session.startsAt),
										session: session.id,
									}}
									className="group flex items-center gap-3"
								>
									<span className="grid w-12 shrink-0 justify-items-center rounded-control bg-muted py-1.5 leading-tight">
										<span className="text-muted-foreground text-xs">
											{weekday.format(session.startsAt)}
										</span>
										<span className="font-numeric text-lg tabular-nums">
											{day.format(session.startsAt)}
										</span>
									</span>
									<span className="grid min-w-0">
										<span className="truncate font-medium text-sm group-hover:underline">
											{session.className}
										</span>
										<span className="truncate text-muted-foreground text-xs">
											<span className="tabular-nums">
												{time.format(session.startsAt)}
											</span>
											{` · ${session.studio}`}
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
