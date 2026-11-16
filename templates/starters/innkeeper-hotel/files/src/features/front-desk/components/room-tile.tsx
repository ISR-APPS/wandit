// One tile of the room wall: the door number, the status, the guest, and the progress of the stay.
// RoomWall renders one tile per room. A click opens the room panel through the `room` search param of /app.
import { Link } from "@tanstack/react-router";
import { countLabel, dayToDate, fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Progress } from "~/shared/ui/progress";
import {
	ROOM_STATUS_DOT,
	type RoomBoardEntry,
	type RoomStatus,
} from "../lib/room-board";

/** The fill of a tile per status. A room with a guest is a full card. An empty room is lighter, as an empty key hook. */
const TILE_SURFACE = {
	occupied: "bg-card",
	departing: "bg-card",
	arriving: "bg-card",
	vacant: "border-dashed bg-background",
	cleaning: "bg-muted",
	out_of_order: "border-destructive/30 bg-destructive/5",
} satisfies Record<RoomStatus, string>;

type RoomTileProps = {
	/** One room of the board, with its live status. */
	entry: RoomBoardEntry;
};

/** A link with a focus ring. Its two text lines change with the status, so each tile has the same height. */
export function RoomTile({ entry }: RoomTileProps) {
	const { t, locale } = useT();
	const { room, status, stay } = entry;
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const guests = stay
		? countLabel(
				stay.guests,
				t("units.guestOne"),
				t("units.guestOther"),
				locale,
			)
		: "";

	// The first line names the guest or the state. The second line gives the live facts.
	let headline = t("frontDesk.ready");
	let detail = entry.nextArrival
		? fillMessage(t("frontDesk.nextArrival"), {
				date: shortDate.format(dayToDate(entry.nextArrival.checkIn)),
			})
		: t("frontDesk.noArrival");
	if (status === "occupied" && stay) {
		headline = stay.guestName;
		detail = `${guests} · ${fillMessage(t("frontDesk.nightOf"), {
			night: entry.nightNumber ?? 1,
			nights: stay.nights,
		})}`;
	} else if (status === "departing" && stay) {
		headline = stay.guestName;
		detail = `${guests} · ${fillMessage(t("frontDesk.leavesBy"), {
			time: time.format(new Date(stay.expectedDepartureAt)),
		})}`;
	} else if (status === "arriving" && stay) {
		headline = stay.guestName;
		detail = `${guests} · ${fillMessage(t("frontDesk.dueAt"), {
			time: time.format(new Date(stay.expectedArrivalAt)),
		})}`;
	} else if (status === "cleaning") {
		headline = t("frontDesk.beingCleaned");
		detail = stay
			? fillMessage(t("frontDesk.arrivalDue"), {
					time: time.format(new Date(stay.expectedArrivalAt)),
				})
			: t("frontDesk.noArrivalToday");
	} else if (status === "out_of_order" && room.outOfOrder) {
		headline = t("frontDesk.closed");
		detail = fillMessage(t("frontDesk.backOn"), {
			date: shortDate.format(dayToDate(room.outOfOrder.until)),
		});
	}
	const hasGuest = status === "occupied" || status === "departing";

	return (
		<Link
			to="/app"
			search={{ room: Number(room.number) }}
			aria-label={fillMessage(t("frontDesk.openRoom"), { number: room.number })}
			className={cn(
				"group flex h-full min-w-0 flex-col gap-3 rounded-surface border p-3 outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				TILE_SURFACE[status],
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="grid min-w-0">
					<span className="font-numeric text-2xl tabular-nums leading-none">
						{room.number}
					</span>
					<span className="mt-1 truncate text-muted-foreground text-xs">
						{t(`roomTypes.${room.type}`)}
					</span>
				</div>
				<span className="inline-flex shrink-0 items-center gap-1.5 pt-0.5 text-xs">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", ROOM_STATUS_DOT[status])}
					/>
					{t(`roomStatuses.${status}`)}
				</span>
			</div>
			<div className="mt-auto grid gap-0.5">
				<span
					className={cn(
						"truncate text-sm",
						stay && status !== "cleaning"
							? "font-medium"
							: "text-muted-foreground",
					)}
					dir="auto"
				>
					{headline}
				</span>
				<span className="truncate text-muted-foreground text-xs tabular-nums">
					{detail}
				</span>
			</div>
			{/* The bar shows the progress of the stay: the night in progress counts. A blank line keeps the height of a tile with no guest. */}
			{hasGuest && stay ? (
				<Progress
					value={entry.nightNumber ?? 0}
					max={stay.nights}
					className="h-1"
					aria-label={t("frontDesk.stayProgress")}
				/>
			) : (
				<span aria-hidden="true" className="h-1" />
			)}
		</Link>
	);
}
