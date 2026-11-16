// The side panel of one table: its status, its facts, its open check or its next booking, the checks of the day,
// and the next actions. FloorPage opens it when the URL has a `table` search param. A tile and an attention row set it.
// It reads one entry of the floor board and the checks of the table. Its links open the order screen and the checks.
import { Link } from "@tanstack/react-router";
import { TableChecksList } from "~/features/orders";
import {
	type FloorTable,
	fillMessage,
	formatCents,
	formatClock,
	formatRelativeTime,
	lineTotalCents,
	moneyFormat,
	type Order,
	orderItemCount,
	orderSubtotalCents,
	TABLE_STATUS_BADGE,
} from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import { Fact } from "./fact";
import { TimeSince } from "./time-since";

type TableSheetProps = {
	/** The table to show. The panel keeps it while it slides out. */
	entry: FloorTable | undefined;
	/** The checks of this table in the business day, newest first, without its open check. */
	checks: Order[];
	/** True while the URL names this table. */
	open: boolean;
	/** Removes the `table` search param. */
	onClose: () => void;
	/** Milliseconds since 1970 at render. */
	now: number;
};

/** A Sheet at the end side. It writes nothing: its buttons are links to other pages. */
export function TableSheet({
	entry,
	checks,
	open,
	onClose,
	now,
}: TableSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	// The guests at the table: on an open check, or seated with no order yet.
	const guests = entry?.openOrder
		? { covers: entry.openOrder.covers, since: entry.openOrder.openedAt }
		: entry?.seating
			? { covers: entry.seating.covers, since: entry.seating.seatedAt }
			: undefined;

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
							<SheetTitle className="font-display font-semibold text-2xl">
								{fillMessage(t("tablePanel.title"), { name: entry.table.name })}
							</SheetTitle>
							<SheetDescription asChild>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant={TABLE_STATUS_BADGE[entry.status]}>
										{t(`tableStatuses.${entry.status}`)}
									</Badge>
									<span>{t(`zones.${entry.table.zone}`)}</span>
								</div>
							</SheetDescription>
						</SheetHeader>
						<div className="grid gap-6 px-6 pb-6">
							<dl className="grid grid-cols-2 gap-4 text-sm">
								<Fact label={t("tablePanel.server")}>
									{entry.server?.name ?? "-"}
								</Fact>
								<Fact label={t("tablePanel.seats")}>
									<span className="tabular-nums">{entry.table.seats}</span>
								</Fact>
								{guests ? (
									<Fact label={t("tablePanel.covers")}>
										<span className="tabular-nums">{guests.covers}</span>
									</Fact>
								) : null}
								{guests ? (
									<Fact label={t("tablePanel.opened")}>
										<TimeSince iso={guests.since} now={now} />
									</Fact>
								) : null}
							</dl>
							<Separator />
							{entry.openOrder ? (
								<section className="grid gap-3">
									<div className="flex items-baseline justify-between gap-3">
										<h3 className="font-semibold text-base">
											{t("tablePanel.check")}
											<span className="ms-2 font-normal text-muted-foreground text-sm tabular-nums">
												#{entry.openOrder.number}
											</span>
										</h3>
										<span className="text-muted-foreground text-xs tabular-nums">
											{fillMessage(t("tablePanel.items"), {
												count: String(orderItemCount(entry.openOrder)),
											})}
										</span>
									</div>
									<ul className="grid gap-2 text-sm">
										{entry.openOrder.lines.map((line) => (
											<li key={line.id} className="flex gap-3">
												<span className="w-6 shrink-0 text-muted-foreground tabular-nums">
													{line.quantity}×
												</span>
												<span className="grid min-w-0 flex-1">
													<span>{line.name}</span>
													{line.note ? (
														<span className="text-muted-foreground text-xs">
															{line.note}
														</span>
													) : null}
												</span>
												<span className="tabular-nums">
													{formatCents(money, lineTotalCents(line))}
												</span>
											</li>
										))}
									</ul>
									<div className="flex items-baseline justify-between border-t pt-3">
										<span className="font-medium text-sm">
											{t("tablePanel.subtotal")}
										</span>
										<span className="font-numeric font-semibold text-xl tabular-nums">
											{formatCents(money, orderSubtotalCents(entry.openOrder))}
										</span>
									</div>
								</section>
							) : entry.reservation ? (
								<section className="grid gap-1">
									<h3 className="font-semibold text-base">
										{t("tablePanel.booking")}
									</h3>
									<p className="text-sm">
										{fillMessage(t("tablePanel.bookingAt"), {
											name: entry.reservation.guestName,
											count: String(entry.reservation.covers),
											time: formatClock(entry.reservation.startsAt, locale),
										})}
									</p>
									<p className="text-muted-foreground text-sm">
										{formatRelativeTime(
											entry.reservation.startsAt,
											now,
											locale,
										)}
									</p>
								</section>
							) : (
								<p className="text-muted-foreground text-sm">
									{entry.lastPaidAt
										? fillMessage(t("tablePanel.lastPaid"), {
												time: formatRelativeTime(entry.lastPaidAt, now, locale),
											})
										: t("tablePanel.noCheck")}
								</p>
							)}
							<section className="grid gap-2">
								<h3 className="font-semibold text-base">
									{t("tablePanel.checksToday")}
								</h3>
								<TableChecksList
									orders={checks}
									emptyText={t("tablePanel.noCheckToday")}
								/>
							</section>
						</div>
						<SheetFooter className="mt-auto flex-row flex-wrap gap-2 border-t p-6">
							<Button asChild className="flex-1">
								<Link to="/app/order" search={{ table: entry.table.id }}>
									{t(
										entry.openOrder
											? "tablePanel.addItems"
											: "tablePanel.takeOrder",
									)}
								</Link>
							</Button>
							{entry.openOrder ? (
								<Button asChild variant="outline" className="flex-1">
									<Link
										to="/app/orders/$orderId"
										params={{ orderId: entry.openOrder.id }}
									>
										{t("tablePanel.openCheck")}
									</Link>
								</Button>
							) : null}
						</SheetFooter>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
