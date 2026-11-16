// The side panel of one guest: the contact facts, the totals, the note of the desk, and the stay history.
// GuestsPage opens it when the URL has a `guest` search param. A guest name in the table sets that param.
// It reads one row of the guests query. Each stay opens its reservation.
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	dayToDate,
	fillMessage,
	initialsOf,
	moneyFormat,
	ReservationStatusBadge,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { GuestRow } from "../lib/guest-rows";
import { GuestPresenceBadge } from "./guest-presence-badge";

type GuestSheetProps = {
	/** The guest to show. The panel keeps it while it slides out. */
	guest: GuestRow | undefined;
	/** True while the URL names this guest. */
	open: boolean;
	/** Removes the `guest` search param. */
	onClose: () => void;
};

/** A Sheet at the end side. */
export function GuestSheet({ guest, open, onClose }: GuestSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const recordDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const country = new Intl.DisplayNames(locale, { type: "region" });
	// `stays` is newest first, so the last stay that started is the first visit of a new guest.
	const firstVisit =
		guest?.guestSince ??
		guest?.stays
			.filter(
				(stay) => stay.status === "checked_in" || stay.status === "checked_out",
			)
			.at(-1)?.checkIn;

	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
		>
			<SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
				{guest ? (
					<>
						<SheetHeader className="gap-4 p-6">
							<div className="flex items-center gap-3 pe-8">
								<Avatar className="size-12">
									<AvatarFallback className="font-display text-base">
										{initialsOf(guest.fullName)}
									</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0 gap-0.5">
									<SheetTitle
										className="truncate font-display font-medium text-2xl"
										dir="auto"
									>
										{guest.fullName}
									</SheetTitle>
									<SheetDescription>
										{`${guest.city}, ${country.of(guest.countryCode) ?? guest.countryCode}`}
									</SheetDescription>
								</div>
							</div>
							<div>
								<GuestPresenceBadge guest={guest} />
							</div>
						</SheetHeader>
						<div className="grid gap-6 px-6 pb-8">
							<dl className="grid grid-cols-3 gap-3 rounded-surface border bg-card p-4">
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("guests.stays")}
									</dt>
									<dd className="font-numeric text-2xl tabular-nums leading-none">
										{number.format(guest.stayCount)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("guests.spend")}
									</dt>
									<dd className="font-numeric text-2xl tabular-nums leading-none">
										{money.format(guest.lifetimeSpend)}
									</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground text-xs">
										{t("guests.guestSince")}
									</dt>
									<dd className="text-sm">
										{firstVisit
											? recordDate.format(dayToDate(firstVisit))
											: t("guests.presence.none")}
									</dd>
								</div>
							</dl>
							<dl className="grid gap-2 text-sm">
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">{t("guests.email")}</dt>
									<dd className="truncate">{guest.email}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">{t("guests.phone")}</dt>
									<dd className="tabular-nums">
										<bdi dir="ltr">{guest.phone}</bdi>
									</dd>
								</div>
							</dl>
							{guest.preference ? (
								<div className="grid gap-1 rounded-surface bg-muted p-4 text-sm">
									<p className="text-muted-foreground text-xs">
										{t("guests.preference")}
									</p>
									<p dir="auto">{guest.preference}</p>
								</div>
							) : null}
							<Separator />
							<section className="grid gap-3">
								<h3 className="font-medium font-sans text-sm">
									{t("guests.history")}
								</h3>
								<ul className="grid gap-2">
									{guest.stays.map((stay) => (
										<li key={stay.reservationId}>
											<Link
												to="/app/reservations/$reservationId"
												params={{ reservationId: stay.reservationId }}
												className="flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
											>
												<span className="grid min-w-0 gap-0.5">
													<span className="font-medium tabular-nums">
														{`${date.format(dayToDate(stay.checkIn))} – ${date.format(dayToDate(stay.checkOut))}`}
													</span>
													<span className="text-muted-foreground text-xs tabular-nums">
														{`${stay.code} · ${fillMessage(t("roomPanel.title"), { number: stay.roomNumber })} · ${countLabel(stay.nights, t("units.nightOne"), t("units.nightOther"), locale)}`}
													</span>
												</span>
												<span className="grid shrink-0 justify-items-end gap-1">
													<ReservationStatusBadge status={stay.status} />
													<span className="text-muted-foreground text-xs tabular-nums">
														{money.format(stay.total)}
													</span>
												</span>
											</Link>
										</li>
									))}
								</ul>
								{guest.earlierStays > 0 ? (
									<p className="text-muted-foreground text-xs">
										{countLabel(
											guest.earlierStays,
											t("guests.earlierStayOne"),
											t("guests.earlierStayOther"),
											locale,
										)}
									</p>
								) : null}
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
