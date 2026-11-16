// The side panel of one order: the buyer, the tickets with their codes, the payment, and the door scan.
// AttendeesPage opens it when the URL has an `order` search param. A guest name in the table sets that param.
import {
	AttendanceBadge,
	type EventSummary,
	fillMessage,
	initialsOf,
	moneyFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { GuestRow } from "../lib/guest-rows";

type GuestSheetProps = {
	/** The order to show. The panel keeps it while it slides out. */
	guest: GuestRow | undefined;
	/** The event of the guest list. */
	event: EventSummary;
	/** True while the URL names this order. */
	open: boolean;
	/** Removes the `order` search param. */
	onClose: () => void;
};

/** A Sheet at the end side. Each ticket of the order has its own code: the reference and a number. */
export function GuestSheet({ guest, event, open, onClose }: GuestSheetProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});

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
				{guest ? (
					<>
						<SheetHeader className="gap-4 p-6">
							<div className="flex items-center gap-3 pe-8">
								<Avatar className="size-12">
									<AvatarFallback className="font-display text-base">
										{initialsOf(guest.buyerName)}
									</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0 gap-0.5">
									<SheetTitle
										className="truncate font-display text-2xl"
										dir="auto"
									>
										{guest.buyerName}
									</SheetTitle>
									<SheetDescription className="truncate">
										{guest.buyerEmail}
									</SheetDescription>
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<AttendanceBadge status={guest.status} />
								<span className="text-muted-foreground text-sm tabular-nums">
									{guest.reference}
								</span>
							</div>
						</SheetHeader>
						<Separator />
						<dl className="grid gap-4 p-6 text-sm">
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("attendees.event")}
								</dt>
								<dd dir="auto">{event.name}</dd>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("attendees.tier")}
									</dt>
									<dd dir="auto">{guest.tierName}</dd>
								</div>
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("attendees.amount")}
									</dt>
									<dd className="tabular-nums">
										{fillMessage(t("attendees.amountLine"), {
											quantity: guest.quantity,
											price: money.format(guest.unitPrice),
											amount: money.format(guest.amount),
										})}
									</dd>
								</div>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">
									{t("attendees.ordered")}
								</dt>
								<dd>{dateTime.format(guest.placedAt)}</dd>
							</div>
							{guest.checkedInAt !== null ? (
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("attendees.scannedAt")}
									</dt>
									<dd>{dateTime.format(guest.checkedInAt)}</dd>
								</div>
							) : null}
							{guest.refundedAt !== null ? (
								<div className="grid gap-1">
									<dt className="text-muted-foreground">
										{t("attendees.refundedAt")}
									</dt>
									<dd>{dateTime.format(guest.refundedAt)}</dd>
								</div>
							) : null}
						</dl>
						<Separator />
						<div className="grid gap-3 p-6">
							<h2 className="font-sans font-semibold text-sm">
								{t("attendees.tickets")}
							</h2>
							<ul className="grid gap-2">
								{Array.from({ length: guest.quantity }, (_, index) => {
									const code = `${guest.reference}-${index + 1}`;
									return (
										<li
											key={code}
											className="flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-sm"
										>
											<span className="tabular-nums">{code}</span>
											<span className="text-muted-foreground text-xs">
												{t(
													guest.status === "refunded"
														? "attendees.ticketVoid"
														: guest.status === "checked_in"
															? "attendees.ticketScanned"
															: "attendees.ticketValid",
												)}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
