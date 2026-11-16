// The alert list of the home: the rooms that the desk cannot give to a guest now, newest change first.
// FrontDeskPage renders it beside the check-ins panel. A row opens the room panel.
import { Link } from "@tanstack/react-router";
import { fillMessage, formatRelativeTime } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import type { RoomBoardEntry } from "../lib/room-board";

type AttentionListProps = {
	/** The rooms in an alert status, from roomAlerts(): out of order or in cleaning, at most 6. */
	alerts: RoomBoardEntry[];
};

/** A Card with one row per room: the number, the status, the reason, and the time since the change. */
export function AttentionList({ alerts }: AttentionListProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("alerts.title")}</CardTitle>
				<CardDescription>{t("alerts.description")}</CardDescription>
				{alerts.length > 0 ? (
					<CardAction>
						<Badge variant="secondary" className="tabular-nums">
							{new Intl.NumberFormat(locale).format(alerts.length)}
						</Badge>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				{alerts.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("alerts.none")}</p>
				) : (
					<ul className="grid">
						{alerts.map((entry) => (
							<li key={entry.room.id} className="border-b last:border-b-0">
								<Link
									to="/app"
									search={{ room: Number(entry.room.number) }}
									className="-mx-2 flex items-start gap-3 rounded-control px-2 py-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-control bg-muted font-numeric tabular-nums">
										{entry.room.number}
									</span>
									<span className="grid min-w-0 flex-1 gap-1">
										<span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
											<Badge
												variant={
													entry.status === "out_of_order"
														? "destructive"
														: "secondary"
												}
											>
												{t(`roomStatuses.${entry.status}`)}
											</Badge>
											<span className="text-muted-foreground text-xs">
												{formatRelativeTime(entry.changedAt, now, locale)}
											</span>
										</span>
										<span className="text-muted-foreground text-sm" dir="auto">
											{entry.room.outOfOrder && entry.status === "out_of_order"
												? entry.room.outOfOrder.reason
												: entry.stay
													? fillMessage(t("alerts.arrivalDue"), {
															time: time.format(
																new Date(entry.stay.expectedArrivalAt),
															),
														})
													: t("alerts.noArrival")}
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

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3"];

/** Placeholder of the alert list while the home loader runs. */
export function AttentionListSkeleton() {
	return (
		<Card>
			<CardHeader>
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-4 w-48" />
			</CardHeader>
			<CardContent className="grid gap-3">
				{SKELETON_ROWS.map((key) => (
					<Skeleton key={key} className="h-14 w-full" />
				))}
			</CardContent>
		</Card>
	);
}
