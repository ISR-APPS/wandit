// The latest activity card of the reservation page: the three newest steps of the stay on a line,
// each with an icon, its label, a badge, the date, and one detail line. "View all" opens the Timeline tab.
// ReservationDetailPage renders it first in the wide column. It follows the latest activity card of the kit.
import {
	ArrowCounterClockwiseIcon,
	CalendarCheckIcon,
	ClockIcon,
	CreditCardIcon,
	EnvelopeSimpleIcon,
	HourglassIcon,
	SignInIcon,
	SignOutIcon,
	UserMinusIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { fillMessage, moneyFormat } from "~/features/hotel";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { ReservationDetail } from "../api/reservations.queries";
import { stepLabel, type TimelineStep } from "../lib/stay-timeline";

/** The icon of each kind of step. */
const STEP_ICON = {
	booked: CalendarCheckIcon,
	deposit: CreditCardIcon,
	prepayment: CreditCardIcon,
	settlement: CreditCardIcon,
	refund: ArrowCounterClockwiseIcon,
	depositDue: HourglassIcon,
	reminder: EnvelopeSimpleIcon,
	arrival: SignInIcon,
	departure: SignOutIcon,
	cancelled: XCircleIcon,
	noShow: UserMinusIcon,
} satisfies Record<TimelineStep["kind"], KitIcon>;

// The card shows the newest steps only. The Timeline tab shows all of them.
const SHOWN_STEPS = 3;

type LatestStepsCardProps = {
	/** The reservation with its timeline, from the detail query. */
	detail: ReservationDetail;
	/** Opens the Timeline tab of the page. */
	onViewAll: () => void;
};

/** Newest first. The newest done step has the "Latest" badge; a step in the future has the "Planned" badge. */
export function LatestStepsCard({ detail, onViewAll }: LatestStepsCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const steps = [...detail.timeline].reverse().slice(0, SHOWN_STEPS);
	const latestDoneId = steps.find((step) => step.isDone)?.id;
	const roomLine = fillMessage(t("reservations.roomNumber"), {
		number: detail.room.number,
	});

	// The detail line of a step: the amount of a payment, the room of a move, the channel of a booking.
	function detailOf(step: TimelineStep): string | null {
		if (step.amount !== null) {
			return money.format(step.amount);
		}
		if (step.kind === "arrival" || step.kind === "departure") {
			return roomLine;
		}
		if (step.kind === "booked") {
			return t(`channels.${detail.reservation.channel}`);
		}
		if (step.kind === "reminder") {
			return detail.guest.email;
		}
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("reservations.latestActivity")}</CardTitle>
				<CardAction>
					<Button type="button" variant="ghost" size="sm" onClick={onViewAll}>
						{t("reservations.viewAll")}
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<ol className="relative ms-3 grid gap-6 border-s ps-6">
					{steps.map((step) => {
						const Icon = STEP_ICON[step.kind];
						const line = detailOf(step);
						return (
							<li key={step.id} className="relative grid gap-1">
								<span
									aria-hidden="true"
									className="absolute -start-9 top-0 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground"
								>
									<Icon className="size-3.5" />
								</span>
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium">
										{stepLabel(step, t, money)}
									</span>
									{step.id === latestDoneId ? (
										<Badge variant="outline">{t("reservations.latest")}</Badge>
									) : !step.isDone ? (
										<Badge variant="info">{t("reservations.planned")}</Badge>
									) : null}
								</div>
								<span className="flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums">
									<ClockIcon className="size-3.5" />
									{dateTime.format(new Date(step.at))}
								</span>
								{line ? (
									<span className="text-muted-foreground text-sm">{line}</span>
								) : null}
							</li>
						);
					})}
				</ol>
			</CardContent>
		</Card>
	);
}
