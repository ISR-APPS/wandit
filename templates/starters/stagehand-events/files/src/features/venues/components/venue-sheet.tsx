// The side panel of one venue: the facts of the room, the contact, the facilities, and its events.
// VenuesPage opens it when the URL has a `venue` search param. Each event opens its page.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
	atMinute,
	countLabel,
	EventStatusBadge,
	type EventSummary,
	moneyFormat,
	SellThrough,
	startOfLocalDay,
	timeFormat,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Separator } from "~/shared/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/shared/ui/sheet";
import type { VenueRow } from "../lib/venue-rows";

type VenueSheetProps = {
	/** The venue to show. The panel keeps it while it slides out. */
	venue: VenueRow | undefined;
	/** True while the URL names this venue. */
	open: boolean;
	/** Removes the `venue` search param. */
	onClose: () => void;
};

/** A Sheet at the end side. The upcoming events show their sales; the recent events show their door count. */
export function VenueSheet({ venue, open, onClose }: VenueSheetProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const money = moneyFormat(locale);
	const time = timeFormat(locale);
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

	const eventLink = (event: EventSummary, detail: ReactNode) => (
		<li key={event.id}>
			<Link
				to="/app/events/$eventId"
				params={{ eventId: event.id }}
				className="grid gap-2 rounded-control border px-3 py-2.5 transition-colors hover:bg-muted/60"
			>
				<span className="flex items-start justify-between gap-3">
					<span className="grid min-w-0">
						<span className="truncate font-medium text-sm" dir="auto">
							{event.name}
						</span>
						<span className="text-muted-foreground text-xs">
							{shortDate.format(event.startsAt)}
						</span>
					</span>
					<EventStatusBadge status={event.status} />
				</span>
				{detail}
			</Link>
		</li>
	);

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
				{venue ? (
					<>
						<SheetHeader className="gap-1 p-6">
							<SheetTitle className="pe-8 font-display text-2xl" dir="auto">
								{venue.name}
							</SheetTitle>
							<SheetDescription>
								{t(`venues.kinds.${venue.kind}`)}
								{" · "}
								<bdi>{venue.area}</bdi>
							</SheetDescription>
						</SheetHeader>
						<Separator />
						<dl className="grid grid-cols-2 gap-4 p-6 text-sm">
							<div className="grid content-start gap-1">
								<dt className="text-muted-foreground">
									{t("venues.capacity")}
								</dt>
								<dd className="tabular-nums">
									{number.format(venue.capacity)}
								</dd>
							</div>
							<div className="grid content-start gap-1">
								<dt className="text-muted-foreground">{t("venues.hireFee")}</dt>
								<dd className="tabular-nums">
									{money.format(venue.hireFeePerDay)}
								</dd>
							</div>
							<div className="grid content-start gap-1">
								<dt className="text-muted-foreground">{t("venues.curfew")}</dt>
								<dd className="tabular-nums">
									{time.format(
										atMinute(startOfLocalDay(Date.now()), venue.curfewMinutes),
									)}
								</dd>
							</div>
							<div className="grid content-start gap-1">
								<dt className="text-muted-foreground">{t("venues.contact")}</dt>
								<dd className="grid min-w-0 justify-items-start">
									<bdi>{venue.contactName}</bdi>
									<a
										href={`mailto:${venue.contactEmail}`}
										className="max-w-full truncate text-muted-foreground underline-offset-4 hover:underline"
									>
										{venue.contactEmail}
									</a>
								</dd>
							</div>
							<div className="col-span-2 grid gap-1">
								<dt className="text-muted-foreground">{t("venues.loadIn")}</dt>
								<dd dir="auto">{venue.loadInNote}</dd>
							</div>
							<div className="col-span-2 grid gap-2">
								<dt className="text-muted-foreground">
									{t("venues.facilitiesTitle")}
								</dt>
								<dd className="flex flex-wrap gap-1.5">
									{venue.facilities.map((facility) => (
										<Badge key={facility} variant="secondary">
											{t(`venues.facilities.${facility}`)}
										</Badge>
									))}
								</dd>
							</div>
						</dl>
						<Separator />
						<section className="grid gap-3 p-6">
							<h3 className="font-sans font-semibold text-sm">
								{t("venues.upcoming")}
							</h3>
							{venue.upcoming.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("venues.nothingBooked")}
								</p>
							) : (
								<ul className="grid gap-2">
									{venue.upcoming.map((event) =>
										eventLink(
											event,
											<SellThrough
												sold={event.sold}
												capacity={event.capacity}
											/>,
										),
									)}
								</ul>
							)}
						</section>
						<Separator />
						<section className="grid gap-3 p-6">
							<h3 className="font-sans font-semibold text-sm">
								{t("venues.recent")}
							</h3>
							{venue.recent.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("venues.noRecent")}
								</p>
							) : (
								<ul className="grid gap-2">
									{venue.recent.map((event) =>
										eventLink(
											event,
											<span className="text-muted-foreground text-xs tabular-nums">
												{countLabel(
													event.checkedIn,
													t("venues.guestAtDoorOne"),
													t("venues.guestAtDoorOther"),
													locale,
												)}
											</span>,
										),
									)}
								</ul>
							)}
						</section>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
