// The profile card at the top of the reservation page: the guest initials, the name with the status,
// the room, three stay figures in a ruled box, and the contact facts with an icon each.
// ReservationDetailPage renders it first in the start column. It follows the profile card of the kit.
import {
	CalendarBlankIcon,
	EnvelopeSimpleIcon,
	HashIcon,
	MapPinIcon,
	PhoneIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
	fillMessage,
	initialsOf,
	moneyFormat,
	ReservationStatusBadge,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Card, CardContent } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { ReservationDetail } from "../api/reservations.queries";

type GuestCardProps = {
	/** The reservation with its guest and room, from the detail query. */
	detail: ReservationDetail;
};

/** The box shows the nights, the party, and the total of the stay. */
export function GuestCard({ detail }: GuestCardProps) {
	const { t, locale } = useT();
	const { reservation, guest, room } = detail;
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const recordDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const country = new Intl.DisplayNames(locale, { type: "region" });
	const figures = [
		{
			id: "nights",
			value: number.format(reservation.nights),
			label: t("reservations.nights"),
		},
		{
			id: "guests",
			value: number.format(reservation.adults + reservation.children),
			label: t("reservations.guests"),
		},
		{
			id: "total",
			value: money.format(reservation.total),
			label: t("reservations.total"),
		},
	];
	const facts: { id: string; icon: KitIcon; text: ReactNode }[] = [
		{ id: "email", icon: EnvelopeSimpleIcon, text: guest.email },
		{ id: "phone", icon: PhoneIcon, text: <bdi dir="ltr">{guest.phone}</bdi> },
		{
			id: "home",
			icon: MapPinIcon,
			text: `${guest.city}, ${country.of(guest.countryCode) ?? guest.countryCode}`,
		},
		{
			id: "booked",
			icon: CalendarBlankIcon,
			text: fillMessage(t("reservations.bookedOnDate"), {
				date: recordDate.format(new Date(reservation.bookedAt)),
			}),
		},
		{ id: "code", icon: HashIcon, text: reservation.code },
	];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-3 text-center">
					<Avatar className="size-20">
						<AvatarFallback className="bg-muted font-display text-2xl">
							{initialsOf(guest.fullName)}
						</AvatarFallback>
					</Avatar>
					<div className="grid gap-1">
						<div className="flex flex-wrap items-center justify-center gap-2">
							<h2 className="font-display font-semibold text-xl" dir="auto">
								{guest.fullName}
							</h2>
							<ReservationStatusBadge status={reservation.status} />
						</div>
						<p className="text-muted-foreground text-sm">
							{`${fillMessage(t("reservations.roomNumber"), { number: room.number })} · ${t(`roomTypes.${room.type}`)}`}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted/50 rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-1 px-2 py-3 text-center">
							<dd className="order-1 font-numeric font-semibold text-lg tabular-nums">
								{figure.value}
							</dd>
							<dt className="order-2 text-muted-foreground text-sm">
								{figure.label}
							</dt>
						</div>
					))}
				</dl>
				<ul className="grid gap-3 text-sm">
					{facts.map((fact) => (
						<li key={fact.id} className="flex min-w-0 items-center gap-3">
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate">{fact.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
