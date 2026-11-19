// The stay facts card of the reservation page: the room, the bed, the view, the board, the party, and the channel
// as outline badges, then the request of the guest and the note of the desk when they exist.
// ReservationDetailPage renders it last in the start column. It follows the skills card of the kit.
import { countLabel } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { ReservationDetail } from "../api/reservations.queries";

type StayFactsCardProps = {
	/** The reservation with its guest and room, from the detail query. */
	detail: ReservationDetail;
};

/** One badge per fact. The texts under the badges keep the words of the guest and of the desk. */
export function StayFactsCard({ detail }: StayFactsCardProps) {
	const { t, locale } = useT();
	const { reservation, guest, room } = detail;
	const tags = [
		t(`roomTypes.${room.type}`),
		t(`beds.${room.bed}`),
		t(`views.${room.view}`),
		t(
			reservation.breakfastIncluded
				? "reservations.breakfastIncluded"
				: "reservations.roomOnly",
		),
		countLabel(
			reservation.adults,
			t("units.adultOne"),
			t("units.adultOther"),
			locale,
		),
		...(reservation.children > 0
			? [
					countLabel(
						reservation.children,
						t("units.childOne"),
						t("units.childOther"),
						locale,
					),
				]
			: []),
		t(`channels.${reservation.channel}`),
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reservations.stayFacts")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<ul className="flex flex-wrap gap-2">
					{tags.map((tag) => (
						<li key={tag}>
							<Badge variant="outline">{tag}</Badge>
						</li>
					))}
				</ul>
				{reservation.request ? (
					<p className="grid gap-0.5 text-sm">
						<span className="text-muted-foreground text-xs">
							{t("reservations.request")}
						</span>
						<span dir="auto">{reservation.request}</span>
					</p>
				) : null}
				{guest.preference ? (
					<p className="grid gap-0.5 text-sm">
						<span className="text-muted-foreground text-xs">
							{t("guests.preference")}
						</span>
						<span dir="auto">{guest.preference}</span>
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
