// The detail page of one reservation: the stay, the folio, the balance, the timeline, and the guest.
// The /app/reservations/$reservationId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { BedIcon, SuitcaseRollingIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import {
	countLabel,
	daysBetween,
	dayToDate,
	fillMessage,
	initialsOf,
	moneyFormat,
	ReservationStatusBadge,
	toIsoDay,
} from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { reservationQueryOptions } from "../api/reservations.queries";
import { FolioCard } from "./folio-card";
import { StayTimeline } from "./stay-timeline";

type ReservationDetailPageProps = {
	/** The `$reservationId` param of the URL, for example "inn-4127". The query treats an unknown id as not found. */
	reservationId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function ReservationDetailPage({
	reservationId,
}: ReservationDetailPageProps) {
	const { t, locale } = useT();
	const { data: detail } = useSuspenseQuery(
		reservationQueryOptions(reservationId),
	);

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
		>
			<Link to="/app/reservations">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("reservations.title")}
			</Link>
		</Button>
	);
	if (!detail) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("reservations.notFound")}
				</p>
			</div>
		);
	}

	const { reservation, guest, room } = detail;
	const money = moneyFormat(locale);
	const share = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const longDate = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const recordDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
	const guestCount = [
		countLabel(
			reservation.adults,
			t("units.adultOne"),
			t("units.adultOther"),
			locale,
		),
		reservation.children > 0
			? countLabel(
					reservation.children,
					t("units.childOne"),
					t("units.childOther"),
					locale,
				)
			: null,
	]
		.filter((part) => part !== null)
		.join(", ");
	// The same rule as the room board: the night in progress counts. The night of the check-in day is night 1.
	const stayProgress =
		reservation.status === "checked_out"
			? reservation.nights
			: reservation.status === "checked_in"
				? Math.min(
						reservation.nights,
						daysBetween(reservation.checkIn, toIsoDay(Date.now())) + 1,
					)
				: 0;
	const didNotHappen =
		reservation.status === "cancelled" || reservation.status === "no_show";
	// A guest with a first booking to come has no stay yet. "0 stays" reads as an error.
	const guestStays =
		detail.guestStayCount === 0
			? t("guests.firstStay")
			: countLabel(
					detail.guestStayCount,
					t("units.stayOne"),
					t("units.stayOther"),
					locale,
				);
	const facts = [
		{ label: t("reservations.guests"), value: guestCount },
		{
			label: t("reservations.room"),
			value: `${room.number} · ${t(`roomTypes.${room.type}`)} · ${t(`beds.${room.bed}`)}`,
		},
		{
			label: t("reservations.rate"),
			value: fillMessage(t("roomPanel.perNight"), {
				amount: money.format(reservation.nightlyRate),
			}),
		},
		{
			label: t("reservations.board"),
			value: t(
				reservation.breakfastIncluded
					? "reservations.breakfastIncluded"
					: "reservations.roomOnly",
			),
		},
		{
			label: t("reservations.channel"),
			value: t(`channels.${reservation.channel}`),
		},
		{
			label: t("reservations.bookedOn"),
			value: recordDate.format(new Date(reservation.bookedAt)),
		},
	];

	return (
		<div className="grid gap-6">
			{backLink}
			<PageHeader
				title={reservation.code}
				description={
					<span className="flex flex-wrap items-center gap-2">
						<ReservationStatusBadge status={reservation.status} />
						<span dir="auto">{guest.fullName}</span>
						<span aria-hidden="true">·</span>
						<span>
							{fillMessage(t("roomPanel.title"), { number: room.number })}
						</span>
					</span>
				}
				actions={
					<>
						<Button asChild variant="outline">
							<Link to="/app/guests" search={{ guest: guest.id }}>
								<SuitcaseRollingIcon />
								{t("reservations.openGuest")}
							</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/app" search={{ room: Number(room.number) }}>
								<BedIcon />
								{fillMessage(t("roomPanel.title"), { number: room.number })}
							</Link>
						</Button>
					</>
				}
			/>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("reservations.stayTitle")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-6">
							{/* At 375 px the two dates share a row and the nights sit under them. A wider card puts the nights between the dates. */}
							<div className="grid @xl/main:grid-cols-[1fr_auto_1fr] grid-cols-2 items-center gap-4">
								<div className="grid gap-1">
									<p className="text-muted-foreground text-xs">
										{t("reservations.arrival")}
									</p>
									<p className="font-display @xl/main:text-2xl text-xl">
										{longDate.format(dayToDate(reservation.checkIn))}
									</p>
									<p className="text-muted-foreground text-sm tabular-nums">
										{fillMessage(
											t(
												reservation.arrivedAt
													? "reservations.arrivedAt"
													: "reservations.expectedAt",
											),
											{
												time: time.format(
													new Date(
														reservation.arrivedAt ??
															reservation.expectedArrivalAt,
													),
												),
											},
										)}
									</p>
								</div>
								<div className="@xl/main:order-none order-last @xl/main:col-span-1 col-span-2 grid @xl/main:w-40 justify-items-center gap-2">
									<p className="font-medium text-sm">
										{countLabel(
											reservation.nights,
											t("units.nightOne"),
											t("units.nightOther"),
											locale,
										)}
									</p>
									<Progress
										value={stayProgress}
										max={reservation.nights}
										className="h-1"
										aria-label={t("frontDesk.stayProgress")}
									/>
								</div>
								<div className="grid justify-items-end gap-1 text-end">
									<p className="text-muted-foreground text-xs">
										{t("reservations.departure")}
									</p>
									<p className="font-display @xl/main:text-2xl text-xl">
										{longDate.format(dayToDate(reservation.checkOut))}
									</p>
									<p className="text-muted-foreground text-sm tabular-nums">
										{fillMessage(
											t(
												reservation.departedAt
													? "reservations.leftAt"
													: "reservations.expectedAt",
											),
											{
												time: time.format(
													new Date(
														reservation.departedAt ??
															reservation.expectedDepartureAt,
													),
												),
											},
										)}
									</p>
								</div>
							</div>
							<dl className="grid @2xl/main:grid-cols-3 grid-cols-2 gap-4 border-t pt-6 text-sm">
								{facts.map((fact) => (
									<div key={fact.label} className="grid gap-1">
										<dt className="text-muted-foreground">{fact.label}</dt>
										<dd>{fact.value}</dd>
									</div>
								))}
							</dl>
							{reservation.request ? (
								<div className="grid gap-1 rounded-surface bg-muted p-4 text-sm">
									<p className="text-muted-foreground text-xs">
										{t("reservations.request")}
									</p>
									<p dir="auto">{reservation.request}</p>
								</div>
							) : null}
						</CardContent>
					</Card>
					<FolioCard
						reservation={reservation}
						charges={detail.charges}
						payments={detail.payments}
					/>
				</div>
				<div className="grid gap-6">
					<Card>
						<CardHeader>
							<CardTitle>{t("reservations.balanceTitle")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-3">
							<p className="font-numeric text-4xl tabular-nums leading-none">
								{money.format(reservation.balance)}
							</p>
							{didNotHappen ? (
								<p className="text-muted-foreground text-sm">
									{t(
										reservation.status === "cancelled"
											? "reservations.cancelledNote"
											: "reservations.noShowNote",
									)}
								</p>
							) : (
								<>
									<Progress
										value={reservation.paid}
										max={reservation.total}
										aria-label={t("reservations.balanceTitle")}
									/>
									<p className="text-muted-foreground text-sm">
										<bdi dir="ltr" className="tabular-nums">
											{share.format(
												reservation.total > 0
													? reservation.paid / reservation.total
													: 0,
											)}
										</bdi>
										{` ${fillMessage(t("reservations.paidOf"), {
											paid: money.format(reservation.paid),
											total: money.format(reservation.total),
										})}`}
									</p>
								</>
							)}
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("timeline.title")}</CardTitle>
						</CardHeader>
						<CardContent>
							<StayTimeline steps={detail.timeline} />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("reservations.guest")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4">
							<div className="flex items-center gap-3">
								<Avatar className="size-10">
									<AvatarFallback>{initialsOf(guest.fullName)}</AvatarFallback>
								</Avatar>
								<div className="grid min-w-0">
									<p className="truncate font-medium" dir="auto">
										{guest.fullName}
									</p>
									<p className="text-muted-foreground text-sm">
										{`${guest.city} · ${guestStays}`}
									</p>
								</div>
							</div>
							<dl className="grid gap-2 text-sm">
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">{t("guests.email")}</dt>
									<dd className="truncate">{guest.email}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-muted-foreground">{t("guests.phone")}</dt>
									<dd className="tabular-nums">
										<bdi dir="ltr">{guest.phone}</bdi>
									</dd>
								</div>
							</dl>
							{guest.preference ? (
								<p className="border-t pt-3 text-sm" dir="auto">
									{guest.preference}
								</p>
							) : null}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function ReservationDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-32" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-5 w-64 max-w-full" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<div className="@5xl/main:col-span-2 grid gap-6">
					<Skeleton className="h-72" />
					<Skeleton className="h-64" />
				</div>
				<div className="grid gap-6">
					<Skeleton className="h-36" />
					<Skeleton className="h-64" />
				</div>
			</div>
		</div>
	);
}
