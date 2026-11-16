// The timeline of one shipment: each step that happened, the newest first, with its time.
// The shipment page renders it. The texts come from the shipment and from the kind of each event.
import {
	ClipboardTextIcon,
	PackageIcon,
	SteeringWheelIcon,
} from "@phosphor-icons/react";
import { dayCountFormat, fillMessage } from "~/features/logistics";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
};

/** One row per event. A delay and a failure have a tinted icon, so a problem shows at once. */
export function ShipmentTimeline({ shipment }: ShipmentTimelineProps) {
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
		<ol className="grid">
			{shipment.events.map((event, index) => {
				const EventIcon = EVENT_ICONS[event.kind];
				const isProblem =
					event.kind === "delay_reported" || event.kind === "failed";
				const isLast = index === shipment.events.length - 1;
				return (
					<li key={event.kind} className="flex gap-3">
						<div className="flex flex-col items-center">
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-full border",
									isProblem
										? "border-destructive/25 bg-destructive/10 text-destructive"
										: event.kind === "delivered"
											? "border-success/25 bg-success/12 text-success"
											: "bg-muted text-foreground",
								)}
							>
								<EventIcon className="size-4" />
							</span>
							{/* The line down to the older event. */}
							{isLast ? null : (
								<span aria-hidden="true" className="w-px flex-1 bg-border" />
							)}
						</div>
						<div
							className={cn(
								// A phone always puts the time under the title, so every row has the same shape.
								"@md/main:flex grid min-w-0 flex-1 @md/main:flex-wrap @md/main:items-baseline @md/main:justify-between gap-x-4 gap-y-0.5 pt-1.5",
								!isLast && "pb-5",
							)}
						>
							<div className="grid min-w-0 gap-0.5">
								<p className="font-medium text-sm">{texts[event.kind].title}</p>
								{texts[event.kind].detail ? (
									<p className="text-muted-foreground text-xs">
										{texts[event.kind].detail}
									</p>
								) : null}
							</div>
							<time
								dateTime={event.occurredAt}
								className="text-muted-foreground text-xs tabular-nums"
							>
								{dateTime.format(new Date(event.occurredAt))}
							</time>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
