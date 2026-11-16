// The home page behind login: the wall of room tiles with a live status, then the check-ins panel,
// the alerts, and the arrivals to come.
// The /app route renders it after its loader. The route also uses the skeleton and the error below.
// The `room` search param of the URL opens the side panel of one room.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { fillMessage } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Skeleton } from "~/shared/ui/skeleton";
import {
	checkInsByChannelQueryOptions,
	frontDeskKpisQueryOptions,
	roomBoardQueryOptions,
} from "../api/front-desk.queries";
import {
	arrivalsTomorrow,
	pendingArrivals,
	roomAlerts,
} from "../lib/room-board";
import { ArrivalsList, ArrivalsListSkeleton } from "./arrivals-list";
import { AttentionList, AttentionListSkeleton } from "./attention-list";
import { CheckInsPanel, CheckInsPanelSkeleton } from "./check-ins-panel";
import { RoomSheet } from "./room-sheet";
import { RoomStatusLine } from "./room-status-line";
import { RoomWall, RoomWallSkeleton } from "./room-wall";

type FrontDeskPageProps = {
	/** The door number in the `room` search param, for example "204". undefined when no panel is open. */
	openRoomNumber: string | undefined;
};

/** The status-board home: the counts per status in the header line, one wall per floor, then the bottom row. */
export function FrontDeskPage({ openRoomNumber }: FrontDeskPageProps) {
	const { t, locale } = useT();
	const navigate = useNavigate();
	const board = useSuspenseQuery(roomBoardQueryOptions());
	const { data: kpis } = useSuspenseQuery(frontDeskKpisQueryOptions());
	const { data: channels } = useSuspenseQuery(checkInsByChannelQueryOptions());
	// The last open room stays in the panel while it slides out. It is view state, not server data.
	const [shownRoomNumber, setShownRoomNumber] = useState(openRoomNumber);
	if (openRoomNumber !== undefined && openRoomNumber !== shownRoomNumber) {
		setShownRoomNumber(openRoomNumber);
	}
	const shownEntry = board.data.find(
		(entry) => entry.room.number === shownRoomNumber,
	);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<div className="grid gap-6">
			<PageHeader
				title={t("frontDesk.title")}
				description={<RoomStatusLine board={board.data} />}
				actions={
					<p className="text-muted-foreground text-sm tabular-nums">
						{fillMessage(t("frontDesk.updated"), {
							time: time.format(new Date(board.dataUpdatedAt)),
						})}
					</p>
				}
			/>
			<RoomWall board={board.data} />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<CheckInsPanel kpis={kpis} channels={channels} />
				{/* The second card of the rail takes the height that is left, so both columns end on one line. */}
				<div className="grid grid-rows-[auto_1fr] @3xl/main:gap-6 gap-4">
					<AttentionList alerts={roomAlerts(board.data)} />
					<ArrivalsList
						arrivals={pendingArrivals(board.data)}
						tomorrow={arrivalsTomorrow(board.data, board.dataUpdatedAt)}
					/>
				</div>
			</div>
			<RoomSheet
				entry={shownEntry}
				open={
					openRoomNumber !== undefined &&
					shownEntry?.room.number === openRoomNumber
				}
				onClose={() => navigate({ to: "/app", search: {} })}
			/>
		</div>
	);
}

/** Placeholder while the home loader runs. The route sets it as pendingComponent. */
export function FrontDeskPageSkeleton() {
	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<RoomWallSkeleton />
			<div className="grid @4xl/main:grid-cols-3 grid-cols-1 @3xl/main:gap-6 gap-4">
				<CheckInsPanelSkeleton />
				<div className="grid grid-rows-[auto_1fr] @3xl/main:gap-6 gap-4">
					<AttentionListSkeleton />
					<ArrivalsListSkeleton />
				</div>
			</div>
		</div>
	);
}

/** Error state of the home when the loader fails. Try again runs the loader again. */
export function FrontDeskPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("frontDesk.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
