// The wall of room tiles of the home page: one group per floor, 6 tiles per row on a wide screen.
// FrontDeskPage renders it under the header. The tiles keep the order of the door numbers.
import { fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Skeleton } from "~/shared/ui/skeleton";
import type { RoomBoardEntry } from "../lib/room-board";
import { RoomTile } from "./room-tile";

/** The floors of the hotel, from the ground up. Its label is the message key `floors.floor<n>`. */
const FLOORS = [1, 2, 3] as const;

type RoomWallProps = {
	/** Every room of the board, in the order of the door numbers. */
	board: RoomBoardEntry[];
};

/** One wall per floor, with the floor name and the count of rooms with a guest. 2 tile columns at 375 px. */
export function RoomWall({ board }: RoomWallProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);

	return (
		<div className="grid gap-5">
			{FLOORS.map((floor) => {
				const rooms = board.filter((entry) => entry.room.floor === floor);
				const inUse = rooms.filter((entry) => entry.guestsInRoom > 0).length;
				return (
					<section key={floor} className="grid gap-2">
						<div className="flex items-baseline justify-between gap-3">
							<h2 className="font-medium font-sans text-sm">
								{t(`floors.floor${floor}`)}
							</h2>
							<p className="text-muted-foreground text-xs tabular-nums">
								{fillMessage(t("frontDesk.inUse"), {
									count: number.format(inUse),
									total: number.format(rooms.length),
								})}
							</p>
						</div>
						<div className="grid @2xl/main:grid-cols-3 @5xl/main:grid-cols-6 grid-cols-2 gap-2">
							{rooms.map((entry) => (
								<RoomTile key={entry.room.id} entry={entry} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}

// Placeholder tiles of one floor. Fixed keys, because the tiles never reorder.
const SKELETON_TILES = ["1", "2", "3", "4", "5", "6"];

/** Placeholder of the wall while the board loads: 3 floors of 6 tiles. */
export function RoomWallSkeleton() {
	return (
		<div className="grid gap-5">
			{FLOORS.map((floor) => (
				<div key={floor} className="grid gap-2">
					<Skeleton className="h-4 w-24" />
					<div className="grid @2xl/main:grid-cols-3 @5xl/main:grid-cols-6 grid-cols-2 gap-2">
						{SKELETON_TILES.map((key) => (
							<Skeleton key={key} className="h-28" />
						))}
					</div>
				</div>
			))}
		</div>
	);
}
