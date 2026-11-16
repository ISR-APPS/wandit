// The Badge that tells where a guest is now: in the house with the room, an arrival with its day, or the last stay.
// The guests table and the guest panel render it.
import { type BadgeVariant, dayToDate, fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import type { GuestPresence, GuestRow } from "../lib/guest-rows";

/** Badge variant per presence. In house is the only green one. */
const PRESENCE_BADGE = {
	in_house: "success",
	arriving: "info",
	upcoming: "secondary",
	past: "outline",
} satisfies Record<GuestPresence, BadgeVariant>;

type GuestPresenceBadgeProps = {
	/** The guest row. The badge reads its presence, its room, and its next and last days. */
	guest: GuestRow;
};

/** A word and a color, with the room number or the day when the row has one. */
export function GuestPresenceBadge({ guest }: GuestPresenceBadgeProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const text =
		guest.presence === "in_house"
			? fillMessage(t("guests.presence.in_house"), {
					room: guest.roomNumber ?? "",
				})
			: guest.presence === "past"
				? // A guest whose only bookings were cancelled has no last stay.
					guest.lastCheckOut
					? fillMessage(t("guests.presence.past"), {
							date: date.format(dayToDate(guest.lastCheckOut)),
						})
					: t("guests.presence.none")
				: fillMessage(t(`guests.presence.${guest.presence}`), {
						date: guest.nextCheckIn
							? date.format(dayToDate(guest.nextCheckIn))
							: "",
					});
	return (
		<Badge variant={PRESENCE_BADGE[guest.presence]} className="tabular-nums">
			{text}
		</Badge>
	);
}
