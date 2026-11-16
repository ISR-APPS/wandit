// The side panel of one room: its status, the guest, the next arrival, the room facts, and the tasks of today.
// FrontDeskPage opens it when the URL has a `room` search param. A room tile and an alert row set that param.
// It reads one entry of the room board. It writes nothing.
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	dayToDate,
	fillMessage,
	formatRelativeTime,
	moneyFormat,
	TASK_STATUS_BADGE,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Progress } from "~/shared/ui/progress";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import {
	ROOM_STATUS_DOT,
	type RoomBoardEntry,
	type RoomStay,
} from "../lib/room-board";

type RoomSheetProps = {
	/** The room to show. The panel keeps it while it slides out. */
	entry: RoomBoardEntry | undefined;
	/** True while the URL names this room. */
	open: boolean;
	/** Removes the `room` search param. */
	onClose: () => void;
};

/** A Sheet at the end side. Its link opens the reservation of the guest. */
export function RoomSheet({ entry, open, onClose }: RoomSheetProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const money = moneyFormat(locale);
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const date = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

	// The stay block is a 2-column list in a 448 px panel. Dates with no weekday stay on one line at 375 px.
	const shortDate = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});

	function stayDates(stay: RoomStay, format: Intl.DateTimeFormat): string {
		return `${format.format(dayToDate(stay.checkIn))} – ${format.format(dayToDate(stay.checkOut))}`;
	}

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
				{entry ? (
					<>
						<SheetHeader className="gap-2 p-6">
							<SheetTitle className="font-display font-medium text-2xl">
								{fillMessage(t("roomPanel.title"), {
									number: entry.room.number,
								})}
							</SheetTitle>
							<SheetDescription>
								{[
									t(`roomTypes.${entry.room.type}`),
									t(`beds.${entry.room.bed}`),
									t(`views.${entry.room.view}`),
									t(`floors.floor${entry.room.floor}`),
								].join(" · ")}
							</SheetDescription>
							<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
								<span
									aria-hidden="true"
									className={cn(
										"size-2 rounded-full",
										ROOM_STATUS_DOT[entry.status],
									)}
								/>
								<span className="font-medium">
									{t(`roomStatuses.${entry.status}`)}
								</span>
								<span aria-hidden="true" className="text-muted-foreground">
									·
								</span>
								<span className="text-muted-foreground">
									{formatRelativeTime(entry.changedAt, now, locale)}
								</span>
							</p>
						</SheetHeader>
						<div className="grid gap-6 px-6 pb-8">
							{entry.room.outOfOrder && entry.status === "out_of_order" ? (
								<section className="grid gap-1 rounded-surface border border-destructive/30 bg-destructive/5 p-4 text-sm">
									<h3 className="font-medium font-sans">
										{t("roomPanel.outOfOrder")}
									</h3>
									<p dir="auto">{entry.room.outOfOrder.reason}</p>
									<p className="text-muted-foreground">
										{fillMessage(t("frontDesk.backOn"), {
											date: date.format(dayToDate(entry.room.outOfOrder.until)),
										})}
									</p>
								</section>
							) : null}
							{entry.stay ? (
								<section className="grid gap-3 rounded-surface border bg-card p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="grid gap-0.5">
											<p className="text-muted-foreground text-xs">
												{t(
													entry.guestsInRoom > 0
														? "roomPanel.guestInRoom"
														: "roomPanel.arrivalToday",
												)}
											</p>
											<p className="font-medium" dir="auto">
												{entry.stay.guestName}
											</p>
										</div>
										<span className="font-numeric text-muted-foreground text-sm tabular-nums">
											{entry.stay.code}
										</span>
									</div>
									<dl className="grid grid-cols-2 gap-3 text-sm">
										<div className="grid gap-0.5">
											<dt className="text-muted-foreground text-xs">
												{t("roomPanel.stay")}
											</dt>
											<dd className="whitespace-nowrap tabular-nums">
												{stayDates(entry.stay, shortDate)}
											</dd>
										</div>
										<div className="grid gap-0.5">
											<dt className="text-muted-foreground text-xs">
												{t("roomPanel.party")}
											</dt>
											<dd>
												{countLabel(
													entry.stay.guests,
													t("units.guestOne"),
													t("units.guestOther"),
													locale,
												)}
											</dd>
										</div>
										<div className="grid gap-0.5">
											<dt className="text-muted-foreground text-xs">
												{t("roomPanel.expectedArrival")}
											</dt>
											<dd className="tabular-nums">
												{time.format(new Date(entry.stay.expectedArrivalAt))}
											</dd>
										</div>
										<div className="grid gap-0.5">
											<dt className="text-muted-foreground text-xs">
												{t("roomPanel.expectedDeparture")}
											</dt>
											<dd className="tabular-nums">
												{time.format(new Date(entry.stay.expectedDepartureAt))}
											</dd>
										</div>
									</dl>
									{entry.nightNumber !== null ? (
										<div className="grid gap-1.5">
											<Progress
												value={entry.nightNumber}
												max={entry.stay.nights}
												aria-label={t("frontDesk.stayProgress")}
											/>
											<p className="text-muted-foreground text-xs tabular-nums">
												{fillMessage(t("frontDesk.nightOf"), {
													night: entry.nightNumber,
													nights: entry.stay.nights,
												})}
											</p>
										</div>
									) : null}
									<Button asChild variant="outline" size="sm">
										<Link
											to="/app/reservations/$reservationId"
											params={{ reservationId: entry.stay.reservationId }}
										>
											{t("roomPanel.openReservation")}
											<ArrowRightIcon className="rtl:rotate-180" />
										</Link>
									</Button>
								</section>
							) : null}
							<section className="grid gap-2">
								<h3 className="font-medium font-sans text-sm">
									{t("roomPanel.nextArrival")}
								</h3>
								{entry.nextArrival ? (
									<Link
										to="/app/reservations/$reservationId"
										params={{ reservationId: entry.nextArrival.reservationId }}
										className="flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
									>
										<span className="grid min-w-0">
											<span className="truncate font-medium" dir="auto">
												{entry.nextArrival.guestName}
											</span>
											<span className="text-muted-foreground text-xs">
												{`${stayDates(entry.nextArrival, date)} · ${countLabel(
													entry.nextArrival.nights,
													t("units.nightOne"),
													t("units.nightOther"),
													locale,
												)}`}
											</span>
										</span>
										<ArrowRightIcon className="shrink-0 text-muted-foreground rtl:rotate-180" />
									</Link>
								) : (
									<p className="text-muted-foreground text-sm">
										{t("roomPanel.noNextArrival")}
									</p>
								)}
							</section>
							<Separator />
							<section className="grid gap-2">
								<h3 className="font-medium font-sans text-sm">
									{t("roomPanel.housekeeping")}
								</h3>
								<ul className="grid gap-2">
									{entry.tasks.map((task) => (
										<li
											key={task.id}
											className="flex items-center justify-between gap-3 text-sm"
										>
											<span className="grid min-w-0">
												<span>{t(`housekeeping.kinds.${task.kind}`)}</span>
												<span className="truncate text-muted-foreground text-xs">
													{task.scheduledAt
														? `${task.attendantName} · ${time.format(new Date(task.scheduledAt))}`
														: task.attendantName}
												</span>
											</span>
											<Badge variant={TASK_STATUS_BADGE[task.status]}>
												{t(`housekeeping.statuses.${task.status}`)}
											</Badge>
										</li>
									))}
								</ul>
							</section>
							<Separator />
							<section className="grid gap-2">
								<h3 className="font-medium font-sans text-sm">
									{t("roomPanel.facts")}
								</h3>
								<dl className="grid grid-cols-2 gap-3 text-sm">
									<div className="grid gap-0.5">
										<dt className="text-muted-foreground text-xs">
											{t("roomPanel.sleeps")}
										</dt>
										<dd>
											{countLabel(
												entry.room.capacity,
												t("units.guestOne"),
												t("units.guestOther"),
												locale,
											)}
										</dd>
									</div>
									<div className="grid gap-0.5">
										<dt className="text-muted-foreground text-xs">
											{t("roomPanel.rate")}
										</dt>
										<dd className="tabular-nums">
											{fillMessage(t("roomPanel.perNight"), {
												amount: money.format(entry.room.nightlyRate),
											})}
										</dd>
									</div>
								</dl>
							</section>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
