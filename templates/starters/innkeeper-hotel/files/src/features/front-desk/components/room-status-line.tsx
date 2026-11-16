// The status line of the home header: one dot, one count, and one word per status that has rooms.
// FrontDeskPage puts it in the description of its PageHeader. It reads the room board.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	ROOM_STATUS_DOT,
	ROOM_STATUSES,
	type RoomBoardEntry,
} from "../lib/room-board";

type RoomStatusLineProps = {
	/** Every room of the board. The line counts them per status. */
	board: RoomBoardEntry[];
};

/** It renders spans only, so it can sit in the <p> of PageHeader. It wraps under the title at 375 px. */
export function RoomStatusLine({ board }: RoomStatusLineProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const counts = ROOM_STATUSES.map((status) => ({
		status,
		count: board.filter((entry) => entry.status === status).length,
	})).filter((item) => item.count > 0);

	return (
		<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{counts.map((item) => (
				<span key={item.status} className="inline-flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className={cn("size-2 rounded-full", ROOM_STATUS_DOT[item.status])}
					/>
					<span className="font-medium text-foreground tabular-nums">
						{number.format(item.count)}
					</span>
					{t(`roomStatuses.${item.status}`)}
				</span>
			))}
		</span>
	);
}
