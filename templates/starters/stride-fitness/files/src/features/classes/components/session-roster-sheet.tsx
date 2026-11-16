// The side panel of one class session: when and where, the fill, and the roster with each check-in.
// ClassesPage opens it for the `session` id of the URL. A close removes the id from the URL.
// A check-in shows only from its time on. After the class, a member with no scan is a no-show.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	checkedInBy,
	MemberAvatar,
	QUIET_BADGE_CLASS,
	SessionPhaseBadge,
	type SessionRow,
	sessionPhaseAt,
} from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Progress } from "~/shared/ui/progress";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";

type SessionRosterSheetProps = {
	/** The session to show, or null when the URL names no session or an unknown one. */
	row: SessionRow | null;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** Called when the user closes the panel. The page removes the id from the URL. */
	onClose: () => void;
};

/** A panel at the end side. It keeps the last row while it slides out, so it never closes empty. */
export function SessionRosterSheet({
	row,
	now,
	onClose,
}: SessionRosterSheetProps) {
	const [shownRow, setShownRow] = useState(row);
	if (row !== null && row !== shownRow) {
		setShownRow(row);
	}
	return (
		<Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{shownRow ? <RosterPanel row={shownRow} now={now} /> : null}
			</SheetContent>
		</Sheet>
	);
}

type RosterPanelProps = {
	row: SessionRow;
	/** The current time in milliseconds since 1970. */
	now: number;
};

// The content of the panel for one session.
function RosterPanel({ row, now }: RosterPanelProps) {
	const { t, locale } = useT();
	const phase = sessionPhaseAt(row, now);
	const checkedIn = checkedInBy(row, now);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const number = new Intl.NumberFormat(locale);
	const hasEnded = row.endsAt <= now;

	const facts = [
		{
			id: "booked",
			label: t("classes.booked"),
			value: `${number.format(row.roster.length)} / ${number.format(row.capacity)}`,
		},
		{
			id: "checked-in",
			label: t("classes.checkedIn"),
			value: number.format(checkedIn.length),
		},
		{
			id: "waitlist",
			label: t("classes.waitlist"),
			value: number.format(row.waitlistCount),
		},
	];

	return (
		<>
			<SheetHeader className="gap-3 border-b p-6 pe-12">
				<div className="flex flex-wrap items-center gap-2">
					<SessionPhaseBadge phase={phase} />
					<span className="text-muted-foreground text-sm">{row.studio}</span>
				</div>
				<SheetTitle className="font-display text-xl">
					{row.className}
				</SheetTitle>
				<SheetDescription>
					{`${date.format(row.startsAt)} · `}
					<span className="whitespace-nowrap tabular-nums">
						{`${time.format(row.startsAt)}–${time.format(row.endsAt)}`}
					</span>
					{" · "}
					<span className="whitespace-nowrap">{row.coachName}</span>
				</SheetDescription>
			</SheetHeader>
			<div className="grid gap-6 p-6">
				<dl className="grid grid-cols-3 gap-3">
					{facts.map((fact) => (
						<div key={fact.id} className="grid gap-1">
							<dt className="label-text text-muted-foreground text-xs">
								{fact.label}
							</dt>
							<dd className="font-numeric text-xl tabular-nums">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
				<Progress
					value={row.roster.length}
					max={row.capacity}
					aria-label={t("classes.booked")}
				/>
				{row.isCancelled ? (
					<p className="text-muted-foreground text-sm">
						{t("classes.cancelledNote")}
					</p>
				) : row.roster.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("classes.emptyRoster")}
					</p>
				) : (
					<section className="grid gap-2" aria-label={t("classes.roster")}>
						<h2 className="font-medium text-sm">{t("classes.roster")}</h2>
						<ul className="grid divide-y">
							{row.roster.map((entry) => (
								<li
									key={entry.memberId}
									className="flex items-center gap-3 py-2.5"
								>
									<MemberAvatar name={entry.fullName} />
									<Link
										to="/app/members/$memberId"
										params={{ memberId: entry.memberId }}
										className="min-w-0 flex-1 truncate font-medium text-sm hover:underline"
									>
										{entry.fullName}
									</Link>
									{entry.checkInAt !== null && entry.checkInAt <= now ? (
										<Badge variant="success">
											<span className="tabular-nums">
												{time.format(entry.checkInAt)}
											</span>
										</Badge>
									) : hasEnded ? (
										<Badge variant="destructive">{t("classes.noShow")}</Badge>
									) : (
										// Booked and not in yet is no news, so it stays quiet beside the check-in times.
										<Badge variant="outline" className={QUIET_BADGE_CLASS}>
											{t("classes.bookedState")}
										</Badge>
									)}
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</>
	);
}
