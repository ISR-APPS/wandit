// The line timeline of one shipment: each step that happened, the newest first, with its time and its detail.
// The shipment page renders it in its timeline card. The texts come from the shipment and from the kind of each event.
import {
	ClipboardTextIcon,
	ClockIcon,
	PackageIcon,
	SteeringWheelIcon,
} from "@phosphor-icons/react";
import { dayCountFormat, fillMessage } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	CheckCircleIcon,
	type KitIcon,
	WarningIcon,
	XCircleIcon,
} from "~/shared/ui/icons";
import type {
	ShipmentDetail,
	ShipmentEventKind,
} from "../api/shipments.queries";

/** The icon of each kind of event. */
const EVENT_ICONS = {
	booked: ClipboardTextIcon,
	assigned: SteeringWheelIcon,
	picked_up: PackageIcon,
	delay_reported: WarningIcon,
	delivered: CheckCircleIcon,
	failed: XCircleIcon,
} satisfies Record<ShipmentEventKind, KitIcon>;

type ShipmentTimelineProps = {
	shipment: ShipmentDetail;
	/** The count of the newest events to show. All events when absent. The Overview tab shows 3. */
	limit?: number;
};

/** One item per event on a start rule. A delay and a failure have a tinted marker, so a problem shows at once. */
export function ShipmentTimeline({ shipment, limit }: ShipmentTimelineProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	});
	const reason = shipment.exceptionReason
		? t(`exceptionReason.${shipment.exceptionReason}`)
		: "";
	const lateText =
		shipment.lateDays > 0
			? fillMessage(t("due.late"), {
					days: dayCountFormat(locale).format(shipment.lateDays),
				})
			: t("deliveryOutcome.on_time");

	// The title and the second line of each kind of event.
	const texts = {
		booked: {
			title: fillMessage(t("shipment.events.booked"), {
				customer: shipment.customerName,
			}),
			detail: t(`serviceLevel.${shipment.service}`),
		},
		assigned: {
			title: fillMessage(t("shipment.events.assigned"), {
				driver: shipment.driverName ?? "",
			}),
			detail: shipment.vehicle
				? `${shipment.vehicleUnit} · ${t(`vehicleKind.${shipment.vehicle.kind}`)}`
				: "",
		},
		picked_up: {
			title: fillMessage(t("shipment.events.pickedUp"), {
				depot: shipment.depotName,
			}),
			detail: "",
		},
		delay_reported: {
			title: t("shipment.events.delayReported"),
			detail: reason,
		},
		delivered: {
			title: t("shipment.events.delivered"),
			detail: `${fillMessage(t("shipment.events.signedBy"), {
				name: shipment.recipient.contactName,
			})} · ${lateText}`,
		},
		failed: {
			title: t("shipment.events.failed"),
			detail: reason,
		},
	} satisfies Record<ShipmentEventKind, { title: string; detail: string }>;

	return (
		// The start rule is the line of the path. Each marker sits on it, centered by -start-3.
		<ol className="relative ms-3 border-s">
			{shipment.events.slice(0, limit).map((event, index) => {
				const EventIcon = EVENT_ICONS[event.kind];
				const isProblem =
					event.kind === "delay_reported" || event.kind === "failed";
				return (
					<li key={event.kind} className="ms-6 grid gap-2 pb-10 last:pb-0">
						<span
							className={cn(
								"absolute -start-3 flex size-6 items-center justify-center rounded-full border",
								isProblem
									? "border-destructive/25 bg-destructive/10 text-destructive"
									: "bg-muted text-primary",
							)}
						>
							<EventIcon className="size-3" />
						</span>
						<p className="flex flex-wrap items-center gap-2 font-semibold">
							{texts[event.kind].title}
							{index === 0 ? (
								<Badge variant="outline">{t("shipment.latest")}</Badge>
							) : null}
						</p>
						<time
							dateTime={event.occurredAt}
							className="flex items-center gap-1.5 text-muted-foreground text-sm tabular-nums leading-none"
						>
							<ClockIcon className="size-3" />
							{dateTime.format(new Date(event.occurredAt))}
						</time>
						{texts[event.kind].detail ? (
							<p className="text-muted-foreground text-sm">
								{texts[event.kind].detail}
							</p>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
