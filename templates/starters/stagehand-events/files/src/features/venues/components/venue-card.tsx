// One venue as a card: its kind and area, its capacity, three figures of use, a fill bar per event, and its facilities.
// VenuesPage renders one per venue. A click opens the side panel of the venue.
import {
	countLabel,
	fillMessage,
	type VenueFacility,
} from "~/features/organiser";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import type { VenueRow } from "../lib/venue-rows";

type VenueCardProps = {
	venue: VenueRow;
	/** Opens the side panel of this venue. */
	onOpen: () => void;
};

// The card shows 3 facilities at most. The panel lists all of them.
const CARD_FACILITIES = 3;

/** The whole card is one button, so the keyboard and the pointer open the panel the same way. */
export function VenueCard({ venue, onOpen }: VenueCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, { style: "percent" });
	const shortDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const dayMonth = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	const next = venue.upcoming[0];
	const seasonFills = venue.season.map((event) => ({
		id: event.id,
		fill: event.sold / event.capacity,
		// A live event has its doors open, so it counts as held.
		isHeld: event.status === "completed" || event.status === "live",
		startsAt: event.startsAt,
	}));
	const shownFacilities: VenueFacility[] = venue.facilities.slice(
		0,
		CARD_FACILITIES,
	);

	return (
		<Card className="relative gap-5 transition-colors hover:border-primary/50">
			<CardContent className="grid gap-1">
				<p className="text-muted-foreground text-xs">
					{t(`venues.kinds.${venue.kind}`)}
					{" · "}
					<bdi>{venue.area}</bdi>
				</p>
				<h2 className="flex items-center justify-between gap-3 font-display font-semibold text-2xl">
					{/* The stretched button covers the card, so the whole card opens the panel. */}
					<button
						type="button"
						onClick={onOpen}
						className="text-start outline-none after:absolute after:inset-0 after:rounded-(--surface-radius) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
						dir="auto"
					>
						{venue.name}
					</button>
					{/* The caret shows that the card opens a panel. */}
					<CaretRightIcon
						aria-hidden="true"
						className="size-5 shrink-0 text-muted-foreground rtl:rotate-180"
					/>
				</h2>
			</CardContent>
			<CardContent>
				<dl className="grid grid-cols-3 gap-4 border-y py-4">
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground text-xs">
							{t("venues.capacity")}
						</dt>
						<dd className="font-numeric text-2xl tabular-nums">
							{number.format(venue.capacity)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground text-xs">
							{t("venues.comingUp")}
						</dt>
						<dd className="font-numeric text-2xl tabular-nums">
							{number.format(venue.upcoming.length)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="label-text text-muted-foreground text-xs">
							{t("venues.averageFill")}
						</dt>
						<dd className="font-numeric text-2xl tabular-nums">
							{venue.averageFill === null
								? "–"
								: percent.format(venue.averageFill)}
						</dd>
					</div>
				</dl>
			</CardContent>
			<CardContent className="grid gap-3">
				<p className="text-sm">
					{next ? (
						<>
							<span className="text-muted-foreground">{t("venues.next")} </span>
							<bdi className="font-medium">{next.name}</bdi>
							<span className="text-muted-foreground">{` · ${shortDate.format(next.startsAt)}`}</span>
						</>
					) : (
						<span className="text-muted-foreground">
							{t("venues.nothingBooked")}
						</span>
					)}
				</p>
				<p className="text-muted-foreground text-xs">
					{venue.recent.length === 0
						? t("venues.noRecent")
						: fillMessage(t("venues.recentLine"), {
								events: countLabel(
									venue.recent.length,
									t("venues.eventOne"),
									t("venues.eventOther"),
									locale,
								),
								guests: number.format(venue.recentGuests),
							})}
				</p>
				<div className="grid gap-1.5">
					<div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
						<span>{t("venues.season")}</span>
						<span className="flex items-center gap-3">
							<span className="flex items-center gap-1">
								<span
									aria-hidden="true"
									className="size-2 rounded-sm bg-primary"
								/>
								{t("venues.seasonHeld")}
							</span>
							<span className="flex items-center gap-1">
								<span
									aria-hidden="true"
									className="size-2 rounded-sm bg-primary/35"
								/>
								{t("venues.seasonAhead")}
							</span>
						</span>
					</div>
					{/* One column per event fills the card width: its fill above the bar, its date under it. */}
					<div
						role="img"
						aria-label={fillMessage(t("venues.seasonChart"), {
							fills: seasonFills
								.map((event) => percent.format(event.fill))
								.join(", "),
						})}
						className="grid auto-cols-fr grid-flow-col gap-2"
					>
						{seasonFills.map((event) => (
							<div
								key={event.id}
								className="grid justify-items-center gap-1 text-muted-foreground text-xs tabular-nums"
							>
								<span>{percent.format(event.fill)}</span>
								<span className="flex h-14 w-full items-end justify-center border-b">
									<span
										className={cn(
											"w-full max-w-12 rounded-t-sm",
											event.isHeld ? "bg-primary" : "bg-primary/35",
										)}
										// A floor of 6 % keeps an event with few sales visible as a bar.
										style={{ height: `${Math.max(event.fill, 0.06) * 100}%` }}
									/>
								</span>
								<span className="whitespace-nowrap">
									{dayMonth.format(event.startsAt)}
								</span>
							</div>
						))}
					</div>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{shownFacilities.map((facility) => (
						<Badge key={facility} variant="secondary">
							{t(`venues.facilities.${facility}`)}
						</Badge>
					))}
					{venue.facilities.length > CARD_FACILITIES ? (
						<Badge variant="outline">
							{`+${number.format(venue.facilities.length - CARD_FACILITIES)}`}
						</Badge>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
